import { expect, type Locator, type Page } from "@playwright/test"

/**
 * A measured audit of a screen's layout, for the pages UG2 stresses with a
 * hostile roster. It reads the DOM the way the rulebook's R04/R18 do:
 * no sideways scroll, no word drawn over another or under a control, no word
 * outside the card or button it belongs to, and no tap target below the size
 * the rulebook asks for. It measures what is drawn at the moment it runs: a
 * word an ancestor clips (a scrolled-out row, or the tail an ellipsis hides)
 * is not drawn, so a scrolling page is audited at each scroll position
 * (`expectCleanWhileScrolling`). Words that an ellipsis clips (by design on
 * the crew composition cards) are listed, not failed: the accessible name
 * keeps them.
 */

export type AuditOptions = {
  /** Smallest side of a control, in CSS px (rulebook R04 prefers 44). */
  minControl?: number
  /** Smallest side for controls in a dense repeated group (R04 allows 40). */
  minDenseControl?: number
  /** Selector for the controls that sit in a dense repeated group. */
  denseControls?: string
  /** Controls left out of the overlap and size checks (floating buttons that
   *  have their own check). */
  ignoreControls?: string
  /** Elements whose content is left out entirely (a fixed bar over the page). */
  ignore?: string
  /**
   * Controls that float over the page cover whatever is scrolled beneath
   * them, by design: a sticky bar over the rows that scroll under it, a fixed
   * button over the page. `top` (the default, for a page at its top) checks
   * everything but the fixed ones; `skip` (a page scrolled part way) checks
   * neither fixed nor sticky ones; `only` (a page scrolled to its end, where
   * nothing may be left under a fixed button) checks nothing but the fixed.
   */
  floating?: "top" | "skip" | "only"
  /** How far (CSS px) a word may reach into a control that does not contain
   *  it before it counts as under it: the crew cards' 44 px remove button
   *  overlaps the last 3-4 px of a clipped name by design. */
  textUnderControlTolerance?: number
}

export type LayoutAudit = {
  issues: string[]
  /** Words an ellipsis hides part of. */
  truncated: string[]
  /** Words a line broke in the middle (a long name has no other way to fit;
   *  a label such as "Volontari" broken in two is a defect). */
  brokenWords: string[]
  stats: {
    words: number
    controls: number
    smallestControl: { name: string; width: number; height: number } | null
    documentWidth: number
    viewportWidth: number
  }
}

export async function auditLayout(
  root: Locator,
  options: AuditOptions = {},
): Promise<LayoutAudit> {
  return root.evaluate((element, settings) => {
    const issues: string[] = []
    const truncated: string[] = []
    const broken: string[] = []
    const minControl = settings.minControl ?? 44
    const minDense = settings.minDenseControl ?? 40
    const ignored = (node: Element | null) =>
      Boolean(settings.ignore && node?.closest(settings.ignore))
    const label = (node: Element) => {
      const text = (node.getAttribute("aria-label") ?? node.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
      return `${node.tagName.toLowerCase()}[${text.slice(0, 48)}]`
    }
    type Box = {
      left: number
      top: number
      right: number
      bottom: number
      /** The height the thing has before an ancestor clips it. */
      fullHeight?: number
    }

    const documentWidth = document.documentElement.scrollWidth
    const viewportWidth = document.documentElement.clientWidth
    if (documentWidth > viewportWidth + 1) {
      issues.push(
        `the page scrolls sideways: ${documentWidth} > ${viewportWidth}`,
      )
    }

    // Containers whose content is wider than they are (R18).
    for (const item of [
      element,
      ...Array.from(element.querySelectorAll("*")),
    ]) {
      if (ignored(item) || item instanceof SVGElement) continue
      if (item.closest(".sr-only")) continue
      if (item.closest("details:not([open])") && !item.closest("summary")) {
        continue
      }
      const style = getComputedStyle(item)
      if (style.display === "none" || style.display === "inline") continue
      if (item.clientWidth === 0) continue
      if (item.scrollWidth > item.clientWidth + 1) {
        if (style.textOverflow === "ellipsis") continue
        // A picture and no words (a boat or tender icon in a column narrower
        // than the icon at 200% text): nothing to read is crowded.
        if (
          !(item.textContent ?? "").trim() &&
          item.querySelector("svg, img")
        ) {
          continue
        }
        // A fixed-size mark that scales its picture down (a boat logo).
        if (
          style.overflowX === "hidden" &&
          Array.from(item.children).some(
            (child) =>
              getComputedStyle(child).transform !== "none" ||
              getComputedStyle(child).scale !== "none",
          )
        ) {
          continue
        }
        issues.push(
          `${label(item)} is wider inside (${item.scrollWidth}) than outside (${item.clientWidth})`,
        )
      }
    }

    /** The part of `box` an ancestor of `from` leaves visible, or null. */
    const visiblePart = (box: Box, from: Element | null): Box | null => {
      let { left, top, right, bottom } = box
      for (
        let ancestor = from;
        ancestor && ancestor !== document.body;
        ancestor = ancestor.parentElement
      ) {
        const clip = getComputedStyle(ancestor)
        if (clip.overflowX === "visible" && clip.overflowY === "visible") {
          continue
        }
        const edge = ancestor.getBoundingClientRect()
        if (clip.overflowX !== "visible") {
          left = Math.max(left, edge.left)
          right = Math.min(right, edge.right)
        }
        if (clip.overflowY !== "visible") {
          top = Math.max(top, edge.top)
          bottom = Math.min(bottom, edge.bottom)
        }
      }
      return right - left > 0 && bottom - top > 0
        ? { left, top, right, bottom }
        : null
    }

    const positionOf = (control: Element) => {
      let sticky = false
      for (
        let node: Element | null = control;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        const position = getComputedStyle(node).position
        if (position === "fixed") return "fixed"
        if (position === "sticky") sticky = true
      }
      return sticky ? "sticky" : "flow"
    }
    const mode = settings.floating ?? "top"

    type Word = Box & { text: string; node: Text; layer: string }
    const words: Word[] = []
    const range = document.createRange()
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text
      const parent = text.parentElement
      if (!parent || ignored(parent)) continue
      const style = getComputedStyle(parent)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (parent.closest("[hidden], .sr-only")) continue
      // What a closed <details> holds is not drawn (its summary is).
      const closed = parent.closest("details:not([open])")
      if (closed && !parent.closest("summary")) continue
      for (const match of text.data.matchAll(/\S+/gu)) {
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        const rects = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0,
        )
        // A word the line broke in the middle (it has pieces on two lines) —
        // unless the word alone is wider than the whole component it lives in
        // (its nearest query container): then no layout could keep it whole,
        // as with a long surname in the profile's 48 px heading at 320 px with
        // 200% text in a wide font. A label too wide for its own narrow column
        // ("Volontari" in a third of the quick bar) still counts.
        if (
          rects.some(
            (rect) => Math.abs(rect.top - rects[0]!.top) > rect.height / 2,
          )
        ) {
          const wordWidth = rects.reduce((sum, rect) => sum + rect.width, 0)
          let container: HTMLElement | null = parent
          while (
            container &&
            getComputedStyle(container).containerType === "normal"
          ) {
            container = container.parentElement
          }
          const containerStyle = container ? getComputedStyle(container) : null
          const containerWidth =
            container && containerStyle
              ? container.clientWidth -
                Number.parseFloat(containerStyle.paddingLeft) -
                Number.parseFloat(containerStyle.paddingRight)
              : Number.POSITIVE_INFINITY
          if (wordWidth <= containerWidth) broken.push(match[0])
        }
        for (const rect of rects) {
          const visible = visiblePart(rect, parent)
          if (!visible) continue
          // An ellipsis (or any clip) that takes width off a word.
          if (visible.right - visible.left < rect.width - 0.75) {
            truncated.push(match[0])
          }
          words.push({
            ...visible,
            fullHeight: rect.height,
            text: match[0],
            node: text,
            layer: positionOf(parent),
          })
        }
      }
    }

    const overlaps = (first: Box, second: Box) => {
      const across =
        Math.min(first.right, second.right) - Math.max(first.left, second.left)
      const down =
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top)
      const smaller = Math.min(
        first.fullHeight ?? first.bottom - first.top,
        second.fullHeight ?? second.bottom - second.top,
      )
      return across > 1 && down > smaller * 0.4
    }

    /**
     * Which layers may be compared. A page at its top (`top`): everything but
     * the fixed ones. Part way down (`skip`): only words and controls of the
     * same layer, because a sticky bar is meant to pass over what scrolls
     * beneath it. At the end (`only`): fixed against the rest.
     */
    const comparable = (first: string, second: string) =>
      mode === "only"
        ? (first === "fixed") !== (second === "fixed")
        : mode === "skip"
          ? first === second
          : first !== "fixed" && second !== "fixed"

    // A word drawn over another word.
    for (let first = 0; first < words.length; first += 1) {
      for (let second = first + 1; second < words.length; second += 1) {
        if (words[first]!.node === words[second]!.node) continue
        if (!comparable(words[first]!.layer, words[second]!.layer)) continue
        if (overlaps(words[first]!, words[second]!)) {
          issues.push(
            `"${words[first]!.text}" overlaps "${words[second]!.text}"`,
          )
        }
      }
    }

    // A word outside the card, button or list item it is inside (a scrolling
    // region is not a card: it only clips, and the words are clipped to it).
    for (const word of words) {
      let boundary = word.node.parentElement?.closest(
        "button, li, article, [role=dialog], [role=region], section",
      )
      while (boundary && getComputedStyle(boundary).overflowY !== "visible") {
        boundary =
          boundary.parentElement?.closest(
            "button, li, article, [role=dialog], [role=region], section",
          ) ?? null
      }
      if (!boundary) continue
      const box = boundary.getBoundingClientRect()
      if (
        word.left < box.left - 1 ||
        word.right > box.right + 1 ||
        word.top < box.top - 2 ||
        word.bottom > box.bottom + 2
      ) {
        issues.push(`"${word.text}" is outside ${label(boundary)}`)
      }
    }

    // Controls: size, and no word beneath one that does not contain it.
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        "button, a[href], select, input:not([type=radio]):not([type=checkbox]), textarea, [role=button]",
      ),
    ).filter((control) => {
      if (ignored(control)) return false
      if (settings.ignoreControls && control.matches(settings.ignoreControls)) {
        return false
      }
      const style = getComputedStyle(control)
      const box = control.getBoundingClientRect()
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width >= 4 &&
        box.height >= 4 &&
        !control.closest(".sr-only")
      )
    })
    let smallest: LayoutAudit["stats"]["smallestControl"] = null
    for (const control of controls) {
      const position = positionOf(control)
      const box = control.getBoundingClientRect()
      const dense = Boolean(
        settings.denseControls && control.matches(settings.denseControls),
      )
      const required = dense ? minDense : minControl
      const side = Math.min(box.width, box.height)
      if (!smallest || side < Math.min(smallest.width, smallest.height)) {
        smallest = {
          name: label(control),
          width: Math.round(box.width * 10) / 10,
          height: Math.round(box.height * 10) / 10,
        }
      }
      if (box.height < required - 0.5 || box.width < required - 0.5) {
        issues.push(
          `${label(control)} is ${Math.round(box.width)}x${Math.round(box.height)}, under ${required}`,
        )
      }
      const shown = visiblePart(box, control.parentElement)
      if (!shown) continue
      const tolerance = settings.textUnderControlTolerance ?? 0
      const covered = {
        left: shown.left + tolerance,
        right: shown.right - tolerance,
        top: shown.top,
        bottom: shown.bottom,
      }
      for (const word of words) {
        if (control.contains(word.node)) continue
        if (!comparable(word.layer, position)) continue
        if (overlaps(word, covered)) {
          issues.push(`"${word.text}" is under ${label(control)}`)
        }
      }
    }

    return {
      issues: [...new Set(issues)],
      truncated: [...new Set(truncated)],
      brokenWords: [...new Set(broken)],
      stats: {
        words: words.length,
        controls: controls.length,
        smallestControl: smallest,
        documentWidth,
        viewportWidth,
      },
    }
  }, options)
}

/** Fails with every finding listed, so one run shows the whole picture. */
export async function expectCleanLayout(
  root: Locator,
  where: string,
  options: AuditOptions = {},
): Promise<LayoutAudit> {
  const audit = await auditLayout(root, options)
  expect(audit.issues, `${where}: ${JSON.stringify(audit.stats)}`).toEqual([])
  return audit
}

/**
 * A page that scrolls inside `scroller` (or the window, when it is null),
 * audited at every scroll position a person reaches by paging down, then at
 * the end with the floating controls checked, and put back at the top. The
 * findings of every position are joined; nothing throws.
 */
export async function auditWhileScrolling(
  root: Locator,
  scroller: Locator | null,
  options: AuditOptions = {},
): Promise<LayoutAudit> {
  const geometry = () =>
    scroller
      ? scroller.evaluate((element) => ({
          height: element.clientHeight,
          total: element.scrollHeight,
        }))
      : root.evaluate(() => ({
          height: window.innerHeight,
          total: document.documentElement.scrollHeight,
        }))
  const scrollTo = (top: number) =>
    scroller
      ? scroller.evaluate((element, to) => element.scrollTo(0, to), top)
      : root.evaluate((_, to) => window.scrollTo(0, to), top)

  const issues = new Set<string>()
  const truncated = new Set<string>()
  const broken = new Set<string>()
  const take = (audit: LayoutAudit, where: string) => {
    audit.issues.forEach((issue) => issues.add(`${issue} (${where})`))
    audit.truncated.forEach((word) => truncated.add(word))
    audit.brokenWords.forEach((word) => broken.add(word))
  }

  await scrollTo(0)
  const first = await auditLayout(root, options)
  take(first, "top")
  let { height, total } = await geometry()
  // Page down by four fifths of what is visible, so every row is seen whole.
  for (let top = Math.round(height * 0.8); top + height < total;) {
    await scrollTo(top)
    take(
      await auditLayout(root, { ...options, floating: "skip" }),
      `scrolled to ${top}`,
    )
    ;({ height, total } = await geometry())
    top += Math.round(height * 0.8)
  }
  await scrollTo(total)
  take(await auditLayout(root, { ...options, floating: "skip" }), "end")
  take(await auditLayout(root, { ...options, floating: "only" }), "end")
  await scrollTo(0)
  return {
    ...first,
    issues: [...issues],
    truncated: [...truncated],
    brokenWords: [...broken],
  }
}

/** `auditWhileScrolling`, failing with every finding of every position. */
export async function expectCleanWhileScrolling(
  root: Locator,
  scroller: Locator | null,
  where: string,
  options: AuditOptions = {},
): Promise<LayoutAudit> {
  const audit = await auditWhileScrolling(root, scroller, options)
  expect(audit.issues, `${where}: ${JSON.stringify(audit.stats)}`).toEqual([])
  return audit
}

/**
 * Rulebook R18: no sideways scroll on the page, and none in any container
 * that scrolls on its own. A page that looks at the document's `scrollWidth`
 * alone misses the inner scroller: the crew composition region has
 * `overflow-y: auto`, which also makes it scroll sideways when a card is wider
 * than it, and the document stays at the width of the screen. Lists every
 * offender (the element, how wide its content is and how wide it is).
 */
export async function expectNoSidewaysScroll(page: Page, where: string) {
  const offenders = await page.evaluate(() => {
    const found: string[] = []
    const candidates = [
      document.documentElement,
      ...Array.from(document.querySelectorAll<HTMLElement>("body *")),
    ]
    for (const element of candidates) {
      if (element.clientWidth === 0) continue
      const style = getComputedStyle(element)
      if (style.display === "none") continue
      const scrolls =
        element === document.documentElement ||
        /(auto|scroll)/.test(style.overflowX)
      if (!scrolls || element.scrollWidth <= element.clientWidth + 1) continue
      const name =
        element.getAttribute("aria-label") ??
        (element.textContent ?? "").replace(/s+/g, " ").trim().slice(0, 30)
      found.push(
        `${element.tagName.toLowerCase()}[${name}] is ${element.scrollWidth} wide inside ${element.clientWidth}`,
      )
    }
    return found
  })
  expect(offenders, `${where}: something scrolls sideways`).toEqual([])
}
