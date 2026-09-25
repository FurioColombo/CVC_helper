const major = Number(process.versions.node.split(".", 1)[0])

if (major !== 24) {
  console.error(
    `CVC_helper requires Node 24; this command is running Node ${process.version}. See docs/LOCAL_DEVELOPMENT.md.`,
  )
  process.exitCode = 1
}
