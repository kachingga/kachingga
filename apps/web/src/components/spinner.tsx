export function Spinner({ fullScreen }: { fullScreen?: boolean }) {
  const dots = (
    <div className="flex gap-2" role="status" aria-label="Cargando">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 150}ms` }}
          className="h-2.5 w-2.5 animate-bounce rounded-full bg-neutral-500"
        />
      ))}
    </div>
  );

  if (fullScreen) {
    return <div className="flex min-h-dvh items-center justify-center bg-black">{dots}</div>;
  }

  return <div className="flex justify-center py-8">{dots}</div>;
}
