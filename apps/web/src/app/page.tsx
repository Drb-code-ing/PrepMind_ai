export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold">PrepMind AI</h1>
      <p className="mt-2 text-lg text-muted-foreground">智能备考，高效复习</p>
      <a
        href="/login"
        className="tap-target mt-8 flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-primary text-white font-medium transition-colors hover:bg-primary-dark active:scale-[0.98]"
      >
        开始使用
      </a>
    </div>
  );
}
