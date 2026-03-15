// SkeletonCard — animated shimmer placeholder while data is loading

interface SkeletonCardProps {
  height?: number;
  rows?: number;
}

export default function SkeletonCard({ height = 120, rows = 3 }: SkeletonCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8e4',
        borderRadius: '8px',
        padding: '16px',
        minHeight: `${height}px`,
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: '12px',
            borderRadius: '4px',
            marginBottom: i < rows - 1 ? '10px' : 0,
            width: i === rows - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}
