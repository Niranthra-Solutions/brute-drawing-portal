export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 20c1.2-3.6 4.2-6 7.8-6.2C15.6 11.6 18 10.4 20.4 10.4c3.1 0 5.4 2 6 4.8l1.2.4-1.2 1.4-1.2 4.2h-3.6l-.7-2.2h-6.2L14 21H8.4L9 20z" fill="none" stroke="#E06A2C" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
