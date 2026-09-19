import { StudentScanImageEditorClassic } from "@/features/students/StudentScanImageEditorClassic"
import { StudentScanImageEditorDocument } from "@/features/students/StudentScanImageEditorDocument"
import { STUDENT_SCAN_EDITOR } from "@/features/students/studentScanEditorChoice"

/**
 * The scan mounts whichever adjustment surface `STUDENT_SCAN_EDITOR` selects.
 * Both implementations take the same props, so comparing them is a one-value
 * change rather than a refactor.
 */
export const StudentScanImageEditor =
  STUDENT_SCAN_EDITOR === "classic"
    ? StudentScanImageEditorClassic
    : StudentScanImageEditorDocument
