export interface RosterImageErasure {
  bytes: Uint8Array
  rules: number
  erasedPixels: number
}

export function eraseRulesFromImageBytes(
  bytes: Uint8Array,
  eraseVerticalTableRules: (
    pixels: Uint8Array,
    width: number,
    height: number,
  ) => { rules: number; erasedPixels: number },
): Promise<RosterImageErasure>
