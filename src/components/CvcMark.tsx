import { assetPath } from "@/lib/assetPath"

type CvcMarkProps = {
  compact?: boolean
}

export function CvcMark({ compact = false }: CvcMarkProps) {
  return (
    <span
      aria-label="CVC"
      className={`cvc-symbol${compact ? " cvc-symbol--compact" : ""}`}
      role="img"
    >
      <img alt="" src={assetPath("/brand/cvc-symbol.png")} />
    </span>
  )
}
