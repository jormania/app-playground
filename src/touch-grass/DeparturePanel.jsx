export default function DeparturePanel({ onDepart }) {
  return (
    <div>
      <h1>Touch Grass</h1>
      <p>Step outside. Come back when you're done.</p>
      <button onClick={onDepart}>Head outside</button>
    </div>
  )
}
