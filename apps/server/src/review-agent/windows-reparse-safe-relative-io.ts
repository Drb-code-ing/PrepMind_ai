import { win32 } from 'node:path';

const BUN_FFI_MODULE = 'bun:ffi';
const FILE_READ_ATTRIBUTES = 0x00000080;
const FILE_READ_DATA = 0x00000001;
const FILE_WRITE_DATA = 0x00000002;
const DELETE = 0x00010000;
const SYNCHRONIZE = 0x00100000;
const FILE_SHARE_READ = 0x00000001;
const FILE_SHARE_WRITE = 0x00000002;
const OPEN_EXISTING = 3;
const FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
const FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
const FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
const OBJ_CASE_INSENSITIVE = 0x00000040;
const OBJ_DONT_REPARSE = 0x00001000;
const FILE_DIRECTORY_FILE = 0x00000001;
const FILE_WRITE_THROUGH = 0x00000002;
const FILE_SYNCHRONOUS_IO_NONALERT = 0x00000020;
const FILE_NON_DIRECTORY_FILE = 0x00000040;
const FILE_OPEN = 1;
const FILE_CREATE = 2;
const FILE_OPEN_IF = 3;
const FILE_RENAME_INFORMATION = 10;
const FILE_DISPOSITION_INFORMATION = 13;
const FILE_STANDARD_INFORMATION = 5;
const FILE_FS_DEVICE_INFORMATION = 4;
const FILE_DEVICE_DISK = 0x00000007;
const FILE_REMOVABLE_MEDIA = 0x00000001;
const FILE_REMOTE_DEVICE = 0x00000010;
const MAX_NATIVE_READ_BYTES = 1_048_576;
const STATUS_REPARSE_POINT_ENCOUNTERED = -1073740533;
const STATUS_OBJECT_NAME_COLLISION = -1073741771;
const STATUS_OBJECT_NAME_NOT_FOUND = -1073741772;
const STATUS_OBJECT_PATH_NOT_FOUND = -1073741766;

type BunFfi = Readonly<{
  FFIType: Record<string, number>;
  dlopen: (
    library: string,
    symbols: Record<
      string,
      Readonly<{ args: readonly number[]; returns: number }>
    >,
  ) => Readonly<{
    symbols: Record<string, (...args: readonly unknown[]) => unknown>;
    close(): void;
  }>;
  ptr: (value: Uint8Array) => number;
}>;

type DurableFaultStage =
  | 'write'
  | 'flush'
  | 'close'
  | 'prepare_create'
  | 'prepare_write'
  | 'prepare_flush'
  | 'prepare_close'
  | 'prepare_reopen'
  | 'rename'
  | 'post_commit_cleanup'
  | 'volume_non_ntfs'
  | 'volume_non_disk_device'
  | 'volume_remote_characteristic'
  | 'volume_removable_characteristic';
type DurableFaultInjector = (stage: DurableFaultStage) => boolean;
type DurableFaultTestCapability = Readonly<{
  injector: DurableFaultInjector;
  pendingCloseHandles: Map<number, ReturnType<BunFfi['dlopen']>>;
}>;

type WindowsNativeDirectory = Readonly<{
  handle: number;
  guardHandles: readonly number[];
  ffi: BunFfi;
  kernel: ReturnType<BunFfi['dlopen']>;
  ntdll: ReturnType<BunFfi['dlopen']>;
  durableFaultTestCapability: DurableFaultTestCapability | null;
}>;

type RelativeHandleInput = Readonly<{
  parent: WindowsNativeDirectory;
  leafName: string;
  desiredAccess: number;
  createDisposition: number;
  createOptions: number;
  returnNullIfNotFound?: boolean;
}>;

type DurablePublicationResult =
  | Readonly<{
      committed: true;
      cleanupStatus: 'closed' | 'close_unverified';
    }>
  | Readonly<{
      committed: false;
      stage:
        | 'prepare_create'
        | 'prepare_write'
        | 'prepare_flush'
        | 'prepare_close'
        | 'prepare_reopen'
        | 'rename';
    }>;

export type WindowsNoReparseChildDirectory = Readonly<{
  close(): void;
  assertLocalFixedNtfsVolume(): void;
  createExclusiveFile(leafName: string, contents: string): void;
  createExclusiveDurableFile(leafName: string, contents: string): void;
  replaceFile(
    temporaryLeafName: string,
    targetLeafName: string,
    contents: string,
  ): void;
  replaceDurableFile(
    temporaryLeafName: string,
    targetLeafName: string,
    contents: string,
  ): void;
  commitExclusiveDurableFileViaRename(
    committedLeafName: string,
    contents: string,
  ): DurablePublicationResult;
  deleteFile(leafName: string): void;
  readRegularFile(leafName: string): Buffer;
}>;

/**
 * Opens a directory tree from an already-open root HANDLE. Every namespace
 * resolution happens through NtCreateFile with OBJ_DONT_REPARSE. The directory
 * HANDLE denies FILE_SHARE_DELETE, so a caller cannot race a junction swap
 * between the safety check and a later evidence operation.
 */
export async function openWindowsNoReparseDirectory(
  root: string,
  childNames: readonly string[],
): Promise<WindowsNoReparseChildDirectory> {
  return openWindowsNoReparseDirectoryWithDisposition(
    root,
    childNames,
    FILE_OPEN_IF,
    null,
  );
}

/** Binds an existing immutable directory tree without ever creating a child. */
export async function openWindowsNoReparseExistingDirectory(
  root: string,
  childNames: readonly string[],
): Promise<WindowsNoReparseChildDirectory> {
  return openWindowsNoReparseDirectoryWithDisposition(
    root,
    childNames,
    FILE_OPEN,
    null,
  );
}

/** Creates an instance-scoped native fault facade for Windows-only tests. */
export async function openWindowsNoReparseChildDirectoryForTests(
  root: string,
  childName: string,
  injector: DurableFaultInjector,
) {
  const capability: DurableFaultTestCapability = {
    injector,
    pendingCloseHandles: new Map(),
  };
  const directory = await openWindowsNoReparseDirectoryWithDisposition(
    root,
    [childName],
    FILE_OPEN_IF,
    capability,
  );
  return Object.freeze({
    directory,
    cleanupInjectedHandles() {
      for (const [handle, kernel] of capability.pendingCloseHandles) {
        let closed = false;
        try {
          closed = Boolean(kernel.symbols.CloseHandle(handle));
        } catch {
          // Converted to the fixed test-cleanup failure below.
        }
        if (!closed) {
          throw new Error('WINDOWS_REPARSE_SAFE_IO_TEST_CLEANUP_FAILED');
        }
        capability.pendingCloseHandles.delete(handle);
      }
    },
  });
}

async function openWindowsNoReparseDirectoryWithDisposition(
  root: string,
  childNames: readonly string[],
  childDisposition: typeof FILE_OPEN | typeof FILE_OPEN_IF,
  durableFaultTestCapability: DurableFaultTestCapability | null,
): Promise<WindowsNoReparseChildDirectory> {
  if (process.platform !== 'win32') {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_UNAVAILABLE');
  }
  if (!childNames.every(isSafeRelativeName)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
  }

  const ffi = await loadBunFfi();
  let directory = openNativeRoot(ffi, root, durableFaultTestCapability);
  try {
    for (const childName of childNames) {
      // Only evidence children beneath the already-bound root may be
      // created. Root and ancestor components are always FILE_OPEN.
      directory = openNativeDirectory(directory, childName, childDisposition);
    }
  } catch (error) {
    closeNativeDirectory(directory);
    throw error;
  }

  const boundDirectory = directory;
  let closed = false;
  const assertOpen = () => {
    if (closed) throw new Error('WINDOWS_REPARSE_SAFE_IO_DIRECTORY_CLOSED');
  };

  return Object.freeze({
    close() {
      if (closed) return;
      closed = true;
      closeNativeDirectory(boundDirectory);
    },
    assertLocalFixedNtfsVolume() {
      assertOpen();
      assertLocalFixedNtfsVolume(boundDirectory);
    },
    createExclusiveFile(leafName, contents) {
      assertOpen();
      assertSafeLeafName(leafName);
      writeNewNativeFile(boundDirectory, leafName, contents);
    },
    createExclusiveDurableFile(leafName, contents) {
      assertOpen();
      assertSafeLeafName(leafName);
      writeNewDurableNativeFile(boundDirectory, leafName, contents);
    },
    replaceFile(temporaryLeafName, targetLeafName, contents) {
      assertOpen();
      assertSafeLeafName(temporaryLeafName);
      assertSafeLeafName(targetLeafName);
      replaceNativeFile(
        boundDirectory,
        temporaryLeafName,
        targetLeafName,
        contents,
      );
    },
    replaceDurableFile(temporaryLeafName, targetLeafName, contents) {
      assertOpen();
      assertSafeLeafName(temporaryLeafName);
      assertSafeLeafName(targetLeafName);
      replaceDurableNativeFile(
        boundDirectory,
        temporaryLeafName,
        targetLeafName,
        contents,
      );
    },
    commitExclusiveDurableFileViaRename(committedLeafName, contents) {
      assertOpen();
      return commitExclusiveDurableFileViaRename(
        boundDirectory,
        committedLeafName,
        contents,
      );
    },
    deleteFile(leafName) {
      assertOpen();
      assertSafeLeafName(leafName);
      deleteNativeFile(boundDirectory, leafName);
    },
    readRegularFile(leafName) {
      assertOpen();
      assertSafeLeafName(leafName);
      return readNativeFile(boundDirectory, leafName);
    },
  });
}

/** Compatibility entry point retained for the first native boundary test. */
export async function openWindowsNoReparseChildDirectory(
  root: string,
  childName: string,
): Promise<WindowsNoReparseChildDirectory> {
  return openWindowsNoReparseDirectory(root, [childName]);
}

async function loadBunFfi(): Promise<BunFfi> {
  try {
    return (await import(BUN_FFI_MODULE)) as BunFfi;
  } catch {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_REQUIRES_BUN');
  }
}

/**
 * Binds a filesystem path from the drive root downwards. `realpath()` is
 * intentionally forbidden here: it resolves a root or one of its ancestors
 * before `OBJ_DONT_REPARSE` can reject that junction. The drive root is the
 * only trusted Win32 anchor; every user-controlled component is opened from
 * the previous HANDLE with `OBJ_DONT_REPARSE`.
 */
function openNativeRoot(
  ffi: BunFfi,
  root: string,
  durableFaultTestCapability: DurableFaultTestCapability | null,
): WindowsNativeDirectory {
  const kernel = ffi.dlopen('kernel32.dll', {
    CreateFileW: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
      ],
      returns: ffi.FFIType.ptr,
    },
    CloseHandle: { args: [ffi.FFIType.ptr], returns: ffi.FFIType.bool },
    GetFileInformationByHandleEx: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.bool,
    },
    GetVolumeInformationByHandleW: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.bool,
    },
  });
  const ntdll = ffi.dlopen('ntdll.dll', {
    NtCreateFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.i32,
    },
    NtWriteFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
      ],
      returns: ffi.FFIType.i32,
    },
    NtReadFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
      ],
      returns: ffi.FFIType.i32,
    },
    NtQueryInformationFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.i32,
    },
    NtQueryVolumeInformationFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.i32,
    },
    NtFlushBuffersFile: {
      args: [ffi.FFIType.ptr, ffi.FFIType.ptr],
      returns: ffi.FFIType.i32,
    },
    NtSetInformationFile: {
      args: [
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.ptr,
        ffi.FFIType.u32,
        ffi.FFIType.u32,
      ],
      returns: ffi.FFIType.i32,
    },
  });
  const driveRoot = trustedVolumeAnchor(root);
  const path = wideString(driveRoot);
  const handle = Number(
    kernel.symbols.CreateFileW(
      ffi.ptr(path),
      FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      // FILE_SHARE_DELETE is intentionally omitted to freeze the bound root.
      FILE_SHARE_READ | FILE_SHARE_WRITE,
      0,
      OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
      0,
    ),
  );
  if (!isNativeHandle(handle)) {
    closeLibraries(kernel, ntdll);
    throw new Error('WINDOWS_REPARSE_SAFE_IO_ROOT_INVALID');
  }
  let directory: WindowsNativeDirectory = {
    handle,
    guardHandles: [],
    ffi,
    kernel,
    ntdll,
    durableFaultTestCapability,
  };
  try {
    assertNotReparsePoint(directory);
    for (const component of nativeRootComponents(root)) {
      directory = openNativeDirectory(directory, component, FILE_OPEN);
    }
    return directory;
  } catch (error) {
    closeNativeDirectory(directory);
    throw error;
  }
}

function openNativeDirectory(
  parent: WindowsNativeDirectory,
  childName: string,
  createDisposition: typeof FILE_OPEN | typeof FILE_OPEN_IF,
): WindowsNativeDirectory {
  const handle = createRelativeHandle({
    parent,
    leafName: childName,
    desiredAccess: FILE_READ_ATTRIBUTES | SYNCHRONIZE,
    createDisposition,
    createOptions: FILE_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
  });
  const directory = {
    ...parent,
    handle,
    guardHandles: [...parent.guardHandles, parent.handle],
  };
  try {
    assertNotReparsePoint(directory);
    return directory;
  } catch (error) {
    closeNativeHandle(directory);
    throw error;
  }
}

function writeNewNativeFile(
  parent: WindowsNativeDirectory,
  leafName: string,
  contents: string,
) {
  const file = createRelativeHandle({
    parent,
    leafName,
    desiredAccess: FILE_WRITE_DATA | DELETE | SYNCHRONIZE,
    createDisposition: FILE_CREATE,
    createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
  });
  try {
    writeAndFlushNativeFile(parent, file, contents);
  } catch (error) {
    closeNativeHandle({ ...parent, handle: file });
    try {
      deleteNativeFile(parent, leafName);
    } catch {
      // The caller converts the failed secure operation to evidence_io.
    }
    throw error;
  }
  closeNativeHandle({ ...parent, handle: file });
}

function writeNewDurableNativeFile(
  parent: WindowsNativeDirectory,
  leafName: string,
  contents: string,
) {
  const file = createRelativeHandle({
    parent,
    leafName,
    desiredAccess: FILE_WRITE_DATA | DELETE | SYNCHRONIZE,
    createDisposition: FILE_CREATE,
    createOptions:
      FILE_WRITE_THROUGH |
      FILE_NON_DIRECTORY_FILE |
      FILE_SYNCHRONOUS_IO_NONALERT,
  });
  try {
    writeAndFlushDurableNativeFile(parent, file, contents);
  } catch (error) {
    try {
      closeDurableNativeHandle(parent, file);
    } catch {
      // Preserve the first fixed write/flush failure.
    }
    try {
      deleteNativeFile(parent, leafName);
    } catch {
      // The caller converts the failed secure operation to evidence_io.
    }
    throw sanitizeDurableWriteError(error);
  }
  try {
    closeDurableNativeHandle(parent, file);
  } catch {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
  }
}

function readNativeFile(parent: WindowsNativeDirectory, leafName: string) {
  const file = createRelativeHandle({
    parent,
    leafName,
    desiredAccess: FILE_READ_DATA | SYNCHRONIZE,
    createDisposition: FILE_OPEN,
    createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
  });
  try {
    return readNativeFileHandle(parent, file);
  } finally {
    closeNativeHandle({ ...parent, handle: file });
  }
}

function readNativeFileHandle(parent: WindowsNativeDirectory, file: number) {
  const standardInformation = Buffer.alloc(24);
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtQueryInformationFile(
        file,
        parent.ffi.ptr(Buffer.alloc(16)),
        parent.ffi.ptr(standardInformation),
        standardInformation.byteLength,
        FILE_STANDARD_INFORMATION,
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_READ_FAILED',
  );
  const length = Number(standardInformation.readBigInt64LE(8));
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > MAX_NATIVE_READ_BYTES
  ) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_READ_FAILED');
  }
  if (length === 0) return Buffer.alloc(0);
  const contents = Buffer.alloc(length);
  const ioStatus = Buffer.alloc(16);
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtReadFile(
        file,
        0,
        0,
        0,
        parent.ffi.ptr(ioStatus),
        parent.ffi.ptr(contents),
        contents.byteLength,
        0,
        0,
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_READ_FAILED',
  );
  if (ioStatus.readBigUInt64LE(8) !== BigInt(contents.byteLength)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_READ_FAILED');
  }
  return contents;
}

function replaceNativeFile(
  parent: WindowsNativeDirectory,
  temporaryLeafName: string,
  targetLeafName: string,
  contents: string,
) {
  let temporaryCreated = false;
  let file: number | null = null;
  try {
    file = createRelativeHandle({
      parent,
      leafName: temporaryLeafName,
      desiredAccess: FILE_WRITE_DATA | DELETE | SYNCHRONIZE,
      createDisposition: FILE_CREATE,
      createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
    });
    temporaryCreated = true;
    writeAndFlushNativeFile(parent, file, contents);
    renameNativeFile(parent, file, targetLeafName);
    temporaryCreated = false;
  } catch (error) {
    if (file !== null) closeNativeHandle({ ...parent, handle: file });
    if (temporaryCreated) {
      try {
        deleteNativeFile(parent, temporaryLeafName);
      } catch {
        // Preserve fail-closed behavior if an owned temporary cannot be removed.
      }
    }
    throw error;
  }
  if (file !== null) closeNativeHandle({ ...parent, handle: file });
}

function replaceDurableNativeFile(
  parent: WindowsNativeDirectory,
  temporaryLeafName: string,
  targetLeafName: string,
  contents: string,
) {
  let temporaryCreated = false;
  let file: number | null = null;
  try {
    file = createRelativeHandle({
      parent,
      leafName: temporaryLeafName,
      desiredAccess: FILE_WRITE_DATA | DELETE | SYNCHRONIZE,
      createDisposition: FILE_CREATE,
      createOptions:
        FILE_WRITE_THROUGH |
        FILE_NON_DIRECTORY_FILE |
        FILE_SYNCHRONOUS_IO_NONALERT,
    });
    temporaryCreated = true;
    writeAndFlushDurableNativeFile(parent, file, contents);
    renameNativeFile(parent, file, targetLeafName);
    temporaryCreated = false;
  } catch (error) {
    if (file !== null) {
      try {
        closeDurableNativeHandle(parent, file);
      } catch {
        // Preserve the first fixed create/write/flush/rename failure.
      }
    }
    if (temporaryCreated) {
      try {
        deleteNativeFile(parent, temporaryLeafName);
      } catch {
        // Preserve fail-closed behavior if an owned temporary cannot be removed.
      }
    }
    throw sanitizeDurableWriteError(error);
  }
  if (file !== null) {
    try {
      closeDurableNativeHandle(parent, file);
    } catch {
      throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
    }
  }
}

function commitExclusiveDurableFileViaRename(
  parent: WindowsNativeDirectory,
  committedLeafName: string,
  contents: string,
): DurablePublicationResult {
  assertSafeLeafName(committedLeafName);
  if (committedLeafName.toLowerCase().endsWith('.prepare')) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
  }
  const prepareLeafName = `${committedLeafName}.prepare`;
  assertSafeLeafName(prepareLeafName);
  if (prepareLeafName === committedLeafName) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
  }
  assertLocalFixedNtfsVolume(parent);
  assertPublicationTargetAbsent(parent, committedLeafName);

  let prepareHandle: number;
  if (shouldInjectDurableFaultForTests(parent, 'prepare_create')) {
    return { committed: false, stage: 'prepare_create' };
  }
  try {
    prepareHandle = createRelativeHandle({
      parent,
      leafName: prepareLeafName,
      desiredAccess: FILE_WRITE_DATA | DELETE | SYNCHRONIZE,
      createDisposition: FILE_CREATE,
      createOptions:
        FILE_WRITE_THROUGH |
        FILE_NON_DIRECTORY_FILE |
        FILE_SYNCHRONOUS_IO_NONALERT,
    });
  } catch {
    return { committed: false, stage: 'prepare_create' };
  }

  const bytes = Buffer.from(contents, 'utf8');
  if (shouldInjectDurableFaultForTests(parent, 'prepare_write')) {
    closeNativeHandle({ ...parent, handle: prepareHandle });
    return { committed: false, stage: 'prepare_write' };
  }
  if (bytes.byteLength > 0) {
    const ioStatus = Buffer.alloc(16);
    try {
      assertNtSuccess(
        Number(
          parent.ntdll.symbols.NtWriteFile(
            prepareHandle,
            0,
            0,
            0,
            parent.ffi.ptr(ioStatus),
            parent.ffi.ptr(bytes),
            bytes.byteLength,
            0,
            0,
          ),
        ),
        'WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED',
      );
      if (ioStatus.readBigUInt64LE(8) !== BigInt(bytes.byteLength)) {
        throw new Error('WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED');
      }
    } catch {
      closeNativeHandle({ ...parent, handle: prepareHandle });
      return { committed: false, stage: 'prepare_write' };
    }
  }
  if (shouldInjectDurableFaultForTests(parent, 'prepare_flush')) {
    closeNativeHandle({ ...parent, handle: prepareHandle });
    return { committed: false, stage: 'prepare_flush' };
  }
  try {
    assertNtSuccess(
      Number(
        parent.ntdll.symbols.NtFlushBuffersFile(
          prepareHandle,
          parent.ffi.ptr(Buffer.alloc(16)),
        ),
      ),
      'WINDOWS_REPARSE_SAFE_IO_FLUSH_FAILED',
    );
  } catch {
    closeNativeHandle({ ...parent, handle: prepareHandle });
    return { committed: false, stage: 'prepare_flush' };
  }
  if (!closePublicationHandle(parent, prepareHandle, 'prepare_close')) {
    return { committed: false, stage: 'prepare_close' };
  }

  if (shouldInjectDurableFaultForTests(parent, 'prepare_reopen')) {
    return { committed: false, stage: 'prepare_reopen' };
  }
  let reopenedHandle: number | null = null;
  try {
    reopenedHandle = createRelativeHandle({
      parent,
      leafName: prepareLeafName,
      desiredAccess: FILE_READ_DATA | DELETE | SYNCHRONIZE,
      createDisposition: FILE_OPEN,
      createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
    });
    const reopenedBytes = readNativeFileHandle(parent, reopenedHandle);
    if (!reopenedBytes.equals(bytes)) {
      throw new Error('WINDOWS_REPARSE_SAFE_IO_READ_FAILED');
    }
  } catch {
    if (reopenedHandle !== null) {
      closeNativeHandle({ ...parent, handle: reopenedHandle });
    }
    return { committed: false, stage: 'prepare_reopen' };
  }

  if (shouldInjectDurableFaultForTests(parent, 'rename')) {
    closeNativeHandle({ ...parent, handle: reopenedHandle });
    return { committed: false, stage: 'rename' };
  }
  try {
    renameNativeFile(parent, reopenedHandle, committedLeafName, false);
  } catch {
    closeNativeHandle({ ...parent, handle: reopenedHandle });
    return { committed: false, stage: 'rename' };
  }
  return {
    committed: true,
    cleanupStatus: closePublicationHandle(
      parent,
      reopenedHandle,
      'post_commit_cleanup',
    )
      ? 'closed'
      : 'close_unverified',
  };
}

function assertPublicationTargetAbsent(
  parent: WindowsNativeDirectory,
  committedLeafName: string,
) {
  const existingHandle = createRelativeHandle({
    parent,
    leafName: committedLeafName,
    desiredAccess: FILE_READ_ATTRIBUTES | SYNCHRONIZE,
    createDisposition: FILE_OPEN,
    createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
    returnNullIfNotFound: true,
  });
  if (existingHandle === null) return;
  if (!closePublicationHandle(parent, existingHandle)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
  }
  throw new Error('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS');
}

function closePublicationHandle(
  parent: WindowsNativeDirectory,
  handle: number,
  faultStage?: 'prepare_close' | 'post_commit_cleanup',
) {
  if (
    faultStage !== undefined &&
    shouldInjectDurableFaultForTests(parent, faultStage)
  ) {
    parent.durableFaultTestCapability?.pendingCloseHandles.set(
      handle,
      parent.kernel,
    );
    return false;
  }
  try {
    return Boolean(parent.kernel.symbols.CloseHandle(handle));
  } catch {
    return false;
  }
}

function deleteNativeFile(parent: WindowsNativeDirectory, leafName: string) {
  const file = createRelativeHandle({
    parent,
    leafName,
    desiredAccess: DELETE | SYNCHRONIZE,
    createDisposition: FILE_OPEN,
    createOptions: FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
  });
  try {
    const disposition = Buffer.from([1]);
    const ioStatus = Buffer.alloc(16);
    assertNtSuccess(
      Number(
        parent.ntdll.symbols.NtSetInformationFile(
          file,
          parent.ffi.ptr(ioStatus),
          parent.ffi.ptr(disposition),
          disposition.byteLength,
          FILE_DISPOSITION_INFORMATION,
        ),
      ),
      'WINDOWS_REPARSE_SAFE_IO_DELETE_FAILED',
    );
  } finally {
    closeNativeHandle({ ...parent, handle: file });
  }
}

function createRelativeHandle(
  input: RelativeHandleInput & Readonly<{ returnNullIfNotFound: true }>,
): number | null;
function createRelativeHandle(input: RelativeHandleInput): number;
function createRelativeHandle(input: RelativeHandleInput) {
  const name = wideString(input.leafName);
  const unicodeName = Buffer.alloc(16);
  unicodeName.writeUInt16LE(name.byteLength - 2, 0);
  unicodeName.writeUInt16LE(name.byteLength, 2);
  unicodeName.writeBigUInt64LE(BigInt(input.parent.ffi.ptr(name)), 8);
  const attributes = Buffer.alloc(48);
  attributes.writeUInt32LE(attributes.byteLength, 0);
  attributes.writeBigUInt64LE(BigInt(input.parent.handle), 8);
  attributes.writeBigUInt64LE(BigInt(input.parent.ffi.ptr(unicodeName)), 16);
  attributes.writeUInt32LE(OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE, 24);
  const resultHandle = Buffer.alloc(8);
  const ioStatus = Buffer.alloc(16);
  const status = Number(
    input.parent.ntdll.symbols.NtCreateFile(
      input.parent.ffi.ptr(resultHandle),
      input.desiredAccess,
      input.parent.ffi.ptr(attributes),
      input.parent.ffi.ptr(ioStatus),
      0,
      0,
      FILE_SHARE_READ | FILE_SHARE_WRITE,
      input.createDisposition,
      input.createOptions,
      0,
      0,
    ),
  );
  if (status !== 0) {
    if (
      input.returnNullIfNotFound === true &&
      (status === STATUS_OBJECT_NAME_NOT_FOUND ||
        status === STATUS_OBJECT_PATH_NOT_FOUND)
    ) {
      return null;
    }
    if (status === STATUS_REPARSE_POINT_ENCOUNTERED) {
      throw new Error('WINDOWS_REPARSE_POINT_BLOCKED');
    }
    if (status === STATUS_OBJECT_NAME_COLLISION) {
      throw new Error('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS');
    }
    throw new Error('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
  }
  const handle = Number(resultHandle.readBigUInt64LE(0));
  if (!isNativeHandle(handle)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
  }
  return handle;
}

function writeAndFlushNativeFile(
  parent: WindowsNativeDirectory,
  file: number,
  contents: string,
) {
  const bytes = Buffer.from(contents, 'utf8');
  const ioStatus = Buffer.alloc(16);
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtWriteFile(
        file,
        0,
        0,
        0,
        parent.ffi.ptr(ioStatus),
        parent.ffi.ptr(bytes),
        bytes.byteLength,
        0,
        0,
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED',
  );
  if (ioStatus.readBigUInt64LE(8) !== BigInt(bytes.byteLength)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED');
  }
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtFlushBuffersFile(
        file,
        parent.ffi.ptr(Buffer.alloc(16)),
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_FLUSH_FAILED',
  );
}

function renameNativeFile(
  parent: WindowsNativeDirectory,
  file: number,
  targetLeafName: string,
  replaceIfExists = true,
) {
  const targetName = wideString(targetLeafName);
  const targetBytes = targetName.byteLength - 2;
  const rename = Buffer.alloc(20 + targetBytes);
  rename.writeUInt8(replaceIfExists ? 1 : 0, 0);
  rename.writeBigUInt64LE(BigInt(parent.handle), 8);
  rename.writeUInt32LE(targetBytes, 16);
  targetName.copy(rename, 20, 0, targetBytes);
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtSetInformationFile(
        file,
        parent.ffi.ptr(Buffer.alloc(16)),
        parent.ffi.ptr(rename),
        rename.byteLength,
        FILE_RENAME_INFORMATION,
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_RENAME_FAILED',
  );
}

function assertNotReparsePoint(directory: WindowsNativeDirectory) {
  const attributeTag = Buffer.alloc(8);
  const isKnown = Boolean(
    directory.kernel.symbols.GetFileInformationByHandleEx(
      directory.handle,
      9,
      directory.ffi.ptr(attributeTag),
      attributeTag.byteLength,
    ),
  );
  if (
    !isKnown ||
    (attributeTag.readUInt32LE(0) & FILE_ATTRIBUTE_REPARSE_POINT) !== 0
  ) {
    throw new Error('WINDOWS_REPARSE_POINT_BLOCKED');
  }
}

function assertLocalFixedNtfsVolume(directory: WindowsNativeDirectory) {
  const deviceInformation = Buffer.alloc(8);
  assertNtSuccess(
    Number(
      directory.ntdll.symbols.NtQueryVolumeInformationFile(
        directory.handle,
        directory.ffi.ptr(Buffer.alloc(16)),
        directory.ffi.ptr(deviceInformation),
        deviceInformation.byteLength,
        FILE_FS_DEVICE_INFORMATION,
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_LOCAL_FIXED_NTFS_REQUIRED',
  );
  let deviceType = deviceInformation.readUInt32LE(0);
  let characteristics = deviceInformation.readUInt32LE(4);
  if (shouldInjectDurableFaultForTests(directory, 'volume_non_disk_device')) {
    deviceType = 0;
  }
  if (
    shouldInjectDurableFaultForTests(
      directory,
      'volume_remote_characteristic',
    )
  ) {
    characteristics |= FILE_REMOTE_DEVICE;
  }
  if (
    shouldInjectDurableFaultForTests(
      directory,
      'volume_removable_characteristic',
    )
  ) {
    characteristics |= FILE_REMOVABLE_MEDIA;
  }
  const fileSystemName = Buffer.alloc(64);
  const volumeKnown = Boolean(
    directory.kernel.symbols.GetVolumeInformationByHandleW(
      directory.handle,
      0,
      0,
      0,
      0,
      0,
      directory.ffi.ptr(fileSystemName),
      fileSystemName.byteLength / 2,
    ),
  );
  const fileSystem = fileSystemName
    .toString('utf16le')
    .split('\0', 1)[0]
    ?.toUpperCase();
  if (
    shouldInjectDurableFaultForTests(directory, 'volume_non_ntfs') ||
    !volumeKnown ||
    deviceType !== FILE_DEVICE_DISK ||
    (characteristics & (FILE_REMOTE_DEVICE | FILE_REMOVABLE_MEDIA)) !== 0 ||
    fileSystem !== 'NTFS'
  ) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_LOCAL_FIXED_NTFS_REQUIRED');
  }
}

function assertNtSuccess(status: number, failureCode: string) {
  if (status !== 0) throw new Error(failureCode);
}

function writeAndFlushDurableNativeFile(
  parent: WindowsNativeDirectory,
  file: number,
  contents: string,
) {
  const bytes = Buffer.from(contents, 'utf8');
  injectDurableFaultForTests(
    parent,
    'write',
    'WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED',
  );
  if (bytes.byteLength > 0) {
    const ioStatus = Buffer.alloc(16);
    assertNtSuccess(
      Number(
        parent.ntdll.symbols.NtWriteFile(
          file,
          0,
          0,
          0,
          parent.ffi.ptr(ioStatus),
          parent.ffi.ptr(bytes),
          bytes.byteLength,
          0,
          0,
        ),
      ),
      'WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED',
    );
    if (ioStatus.readBigUInt64LE(8) !== BigInt(bytes.byteLength)) {
      throw new Error('WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED');
    }
  }
  injectDurableFaultForTests(
    parent,
    'flush',
    'WINDOWS_REPARSE_SAFE_IO_FLUSH_FAILED',
  );
  assertNtSuccess(
    Number(
      parent.ntdll.symbols.NtFlushBuffersFile(
        file,
        parent.ffi.ptr(Buffer.alloc(16)),
      ),
    ),
    'WINDOWS_REPARSE_SAFE_IO_FLUSH_FAILED',
  );
}

function injectDurableFaultForTests(
  parent: WindowsNativeDirectory,
  stage: DurableFaultStage,
  failureCode: string,
) {
  if (shouldInjectDurableFaultForTests(parent, stage)) {
    throw new Error(failureCode);
  }
}

function shouldInjectDurableFaultForTests(
  parent: WindowsNativeDirectory,
  stage: DurableFaultStage,
) {
  const capability = parent.durableFaultTestCapability;
  if (capability === null) return false;
  try {
    return Boolean(capability.injector(stage));
  } catch {
    return true;
  }
}

function sanitizeDurableWriteError(error: unknown) {
  if (
    error instanceof Error &&
    /^WINDOWS_REPARSE(?:_POINT_BLOCKED|_SAFE_IO_[A-Z_]+)$/.test(error.message)
  ) {
    return error;
  }
  return new Error('WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED');
}

function isSafeRelativeName(value: string) {
  return /^[A-Za-z0-9._-]{1,240}$/.test(value);
}

function trustedVolumeAnchor(root: string) {
  const normalized = win32.normalize(root);
  const parsed = win32.parse(normalized);
  if (!/^[A-Za-z]:\\$/.test(parsed.root)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_ROOT_INVALID');
  }
  return parsed.root;
}

function nativeRootComponents(root: string) {
  const normalized = win32.normalize(root);
  const anchor = trustedVolumeAnchor(normalized);
  const remainder = normalized.slice(anchor.length);
  const components = remainder.split('\\').filter(Boolean);
  if (!components.every(isSafeNativePathComponent)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_ROOT_INVALID');
  }
  return components;
}

function isSafeNativePathComponent(value: string) {
  return (
    value.length > 0 &&
    value.length <= 240 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\/\0]/.test(value)
  );
}

function assertSafeLeafName(value: string) {
  if (!isSafeRelativeName(value)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
  }
}

function isNativeHandle(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value !== -1;
}

function closeNativeHandle(directory: WindowsNativeDirectory) {
  directory.kernel.symbols.CloseHandle(directory.handle);
}

function closeDurableNativeHandle(
  parent: WindowsNativeDirectory,
  handle: number,
) {
  if (shouldInjectDurableFaultForTests(parent, 'close')) {
    parent.durableFaultTestCapability?.pendingCloseHandles.set(
      handle,
      parent.kernel,
    );
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
  }
  let closed = false;
  try {
    closed = Boolean(parent.kernel.symbols.CloseHandle(handle));
  } catch {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
  }
  if (!closed) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
  }
}

function closeNativeDirectory(directory: WindowsNativeDirectory) {
  try {
    closeNativeHandle(directory);
    for (const handle of [...directory.guardHandles].reverse()) {
      directory.kernel.symbols.CloseHandle(handle);
    }
  } finally {
    closeLibraries(directory.kernel, directory.ntdll);
  }
}

function closeLibraries(
  kernel: ReturnType<BunFfi['dlopen']>,
  ntdll: ReturnType<BunFfi['dlopen']>,
) {
  try {
    ntdll.close();
  } finally {
    kernel.close();
  }
}

function wideString(value: string) {
  return Buffer.from(`${value}\0`, 'utf16le');
}
