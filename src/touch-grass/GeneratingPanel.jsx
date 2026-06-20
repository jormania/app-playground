import LoadingLine from './LoadingLine.jsx'

const TIER_STYLE = {
  uncommon:  { color: '#3ab0c0' },
  rare:      { color: '#c49830' },
  legendary: { color: '#c060e0' },
}

export default function GeneratingPanel({ tier }) {
  const style = tier ? TIER_STYLE[tier] : null

  return (
    <div>
      <h1>
        Divining your{style
          ? <> <span style={style}>{tier}</span></>
          : ''} find…
      </h1>
      <LoadingLine />
    </div>
  )
}
