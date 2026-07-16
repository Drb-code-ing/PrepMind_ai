import { realpath } from 'node:fs/promises';

const BUN_FFI_MODULE = 'bun:ffi';
const FILE_READ_ATTRIBUTES = 0x00000080;
const SYNCHRONIZE = 0x00100000;
const FILE_SHARE_READ = 0x00000001;
const FILE_SHARE_WRITE = 0x00000002;
const FILE_SHARE_DELETE = 0x00000004;
const OPEN_EXISTING = 3;
const FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
const FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
const FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
const OBJ_CASE_INSENSITIVE = 0x00000040;
const OBJ_DONT_REPARSE = 0x00001000;
const FILE_DIRECTORY_FILE = 0x00000001;
const FILE_SYNCHRONOUS_IO_NONALERT = 0x00000020;
const STATUS_REPARSE_POINT_ENCOUNTERED = -1073740533;

type BunFfi = Readonly<{
  FFIType: Record<string, number>;
  dlopen: (
    library: string,
    symbols: Record<string, Readonly<{ args: readonly number[]; returns: number }>>,
  ) => Readonly<{ symbols: Record<string, (...args: readonly unknown[]) => unknown>; close(): void }>;
  ptr: (value: Uint8Array) => number;
}>;

type WindowsNativeDirectory = Readonly<{
  handle: number;
  ffi: BunFfi;
  kernel: ReturnType<BunFfi['dlopen']>;
  ntdll: ReturnType<BunFfi['dlopen']>;
}>;

export type WindowsNoReparseChildDirectory = Readonly<{
  close(): void;
}>;

/**
 * Opens a direct child directory relative to an already-open root HANDLE.
 * `OBJ_DONT_REPARSE` makes a post-check junction swap fail in the kernel before
 * a child path can be resolved outside that root object.
 */
export async function openWindowsNoReparseChildDirectory(
  root: string,
  childName: string,
): Promise<WindowsNoReparseChildDirectory> {
  if (process.platform !== 'win32') {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_UNAVAILABLE');
  }
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(childName)) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
  }

  const ffi = await loadBunFfi();
  const nativeRoot = await openNativeRoot(ffi, await realpath(root));
  try {
    const child = openNativeChildDirectory(nativeRoot, childName);
    closeNativeHandle(nativeRoot);
    return Object.freeze({
      close() {
        closeNativeDirectory(child);
      },
    });
  } catch (error) {
    closeNativeDirectory(nativeRoot);
    throw error;
  }
}

async function loadBunFfi(): Promise<BunFfi> {
  try {
    return (await import(BUN_FFI_MODULE)) as BunFfi;
  } catch {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_REQUIRES_BUN');
  }
}

async function openNativeRoot(
  ffi: BunFfi,
  root: string,
): Promise<WindowsNativeDirectory> {
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
      args: [ffi.FFIType.ptr, ffi.FFIType.u32, ffi.FFIType.ptr, ffi.FFIType.u32],
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
  });
  const path = wideString(root);
  const handle = Number(
    kernel.symbols.CreateFileW(
      ffi.ptr(path),
      FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      0,
      OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
      0,
    ),
  );
  if (!Number.isSafeInteger(handle) || handle <= 0 || handle === -1) {
    ntdll.close();
    kernel.close();
    throw new Error('WINDOWS_REPARSE_SAFE_IO_ROOT_INVALID');
  }
  const attributeTag = Buffer.alloc(8);
  const isKnown = Boolean(
    kernel.symbols.GetFileInformationByHandleEx(
      handle,
      9,
      ffi.ptr(attributeTag),
      attributeTag.byteLength,
    ),
  );
  if (
    !isKnown ||
    (attributeTag.readUInt32LE(0) & FILE_ATTRIBUTE_REPARSE_POINT) !== 0
  ) {
    kernel.symbols.CloseHandle(handle);
    ntdll.close();
    kernel.close();
    throw new Error('WINDOWS_REPARSE_POINT_BLOCKED');
  }
  return { handle, ffi, kernel, ntdll };
}

function openNativeChildDirectory(
  parent: WindowsNativeDirectory,
  childName: string,
): WindowsNativeDirectory {
  const name = wideString(childName);
  const unicodeName = Buffer.alloc(16);
  unicodeName.writeUInt16LE(name.byteLength - 2, 0);
  unicodeName.writeUInt16LE(name.byteLength, 2);
  unicodeName.writeBigUInt64LE(BigInt(parent.ffi.ptr(name)), 8);
  const attributes = Buffer.alloc(48);
  attributes.writeUInt32LE(attributes.byteLength, 0);
  attributes.writeBigUInt64LE(BigInt(parent.handle), 8);
  attributes.writeBigUInt64LE(BigInt(parent.ffi.ptr(unicodeName)), 16);
  attributes.writeUInt32LE(OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE, 24);
  const resultHandle = Buffer.alloc(8);
  const ioStatus = Buffer.alloc(16);
  const status = Number(
    parent.ntdll.symbols.NtCreateFile(
      parent.ffi.ptr(resultHandle),
      FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      parent.ffi.ptr(attributes),
      parent.ffi.ptr(ioStatus),
      0,
      0,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      OPEN_EXISTING,
      FILE_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT,
      0,
      0,
    ),
  );
  if (status !== 0) {
    if (status === STATUS_REPARSE_POINT_ENCOUNTERED) {
      throw new Error('WINDOWS_REPARSE_POINT_BLOCKED');
    }
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CHILD_INVALID');
  }
  const handle = Number(resultHandle.readBigUInt64LE(0));
  if (!Number.isSafeInteger(handle) || handle <= 0 || handle === -1) {
    throw new Error('WINDOWS_REPARSE_SAFE_IO_CHILD_INVALID');
  }
  return { ...parent, handle };
}

function closeNativeHandle(directory: WindowsNativeDirectory) {
  directory.kernel.symbols.CloseHandle(directory.handle);
}

function closeNativeDirectory(directory: WindowsNativeDirectory) {
  try {
    closeNativeHandle(directory);
  } finally {
    directory.ntdll.close();
    directory.kernel.close();
  }
}

function wideString(value: string) {
  return Buffer.from(`${value}\0`, 'utf16le');
}
