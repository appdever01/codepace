export default function CheckeredFlag({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="16" rx="1.2" fill="#111" />
      {Array.from({ length: 24 }, (_, index) => {
        const column = index % 6;
        const row = Math.floor(index / 6);
        if ((column + row) % 2) return null;
        return (
          <rect
            key={index}
            x={column * 4}
            y={row * 4}
            width="4"
            height="4"
            fill="#f4f4f4"
          />
        );
      })}
    </svg>
  );
}
