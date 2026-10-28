// Fixed 3D grid "floor" behind the homepage — a plane tipped back in
// perspective, fading out toward the horizon, whose lines glide toward you as
// the page scrolls (.zl-backdrop in globals.css). Purely decorative.
export default function HomeBackdrop() {
  return (
    <div aria-hidden className="zl-backdrop">
      <div className="zl-backdrop-floor">
        <div className="zl-backdrop-plane" />
      </div>
    </div>
  );
}
