export type Role = "Admin" | "User";
export interface User {
  id: string;
  email: string;
  fullName: string;
  department: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
}
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface NamedItem {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
export interface ModelItem {
  id: string;
  makeId: string;
  vehicleTypeId: string;
  categoryId: string;
  name: string;
  capacity: string;
  isActive: boolean;
}
export interface AhItem {
  id: string;
  value: number;
  standard: string;
  label: string;
  isActive: boolean;
}
export interface VoltageItem {
  id: string;
  valueV: number;
  isActive: boolean;
}
export interface Tolerance {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}
export interface Bootstrap {
  categories: NamedItem[];
  vehicleTypes: NamedItem[];
  makes: NamedItem[];
  connectors: NamedItem[];
  models: ModelItem[];
  voltages: VoltageItem[];
  ahRatings: AhItem[];
  drawingNumberMask: string;
  drawingNumberExample: string;
  tolerance: Tolerance;
}
export interface Drawing {
  id: string;
  drawingNumber: string;
  make: string;
  makeId: string;
  vehicleType: string;
  category: string;
  model: string;
  modelId: string;
  capacity: string;
  voltageV: number;
  ah: string;
  ahValue: number;
  ahStandard: string;
  connector: string;
  connectorId: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  comments: string | null;
  competitorDrawingNumber: string | null;
  status: "Active" | "Archived";
  revisionLabel: string;
  fileId: string | null;
  fileName: string | null;
  canPreview: boolean;
  updatedAtUtc: string;
}
export interface Suggestion {
  drawing: Drawing;
  deltaLength: number;
  deltaWidth: number;
  deltaHeight: number;
  fitPercent: number;
  sameModel: boolean;
  sameMake: boolean;
  sameAh: boolean;
}
export interface SearchResult {
  mode: "Standard" | "NonStandard" | "None";
  exact: Drawing[];
  similar: Suggestion[];
  tolerance: Tolerance;
  note: string | null;
  totalCandidates: number;
}
export interface Revision {
  id: string;
  revisionNo: number;
  label: string;
  drawingNumber: string;
  fileId: string | null;
  fileName: string | null;
  changeNotes: string | null;
  createdAtUtc: string;
  createdByName: string | null;
  requestTicketNo: string | null;
  isCurrent: boolean;
}
export interface FileInfo {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  url: string;
  createdAtUtc: string;
  canPreview: boolean;
}
export interface DrawingDetail {
  drawing: Drawing;
  revisions: Revision[];
  file: FileInfo | null;
  createdAtUtc: string;
  createdByName: string | null;
  matchedNote: string | null;
}
export interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  url: string;
  absoluteUrl: string;
  sha256: string;
}
export interface DrawingFileItem {
  id: string;
  name: string;
  extension: string;
  sizeBytes: number;
  contentType: string;
  url: string;
  absoluteUrl: string;
  uploadedAtUtc: string;
  uploadedByName: string | null;
  usedByCount: number;
  usedBy: FileUsage[];
}
export interface FileUsage {
  drawingId: string;
  drawingNumber: string;
  category: string;
  make: string;
  vehicleType: string;
  model: string;
  capacity: string;
  voltageV: number;
  ah: string;
  connector: string;
  size: string;
  status: string;
  revisionNo: number;
  currentRevisionNo: number;
  isCurrentFile: boolean;
}
export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  fileId: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  createdAtUtc: string;
  canPreview: boolean;
}
export type RequestStatus =
  | "Submitted"
  | "InReview"
  | "Assigned"
  | "InProgress"
  | "Completed"
  | "Rejected";
export interface RequestListItem {
  id: string;
  ticketNo: string;
  type: "New" | "Modification";
  status: RequestStatus;
  priority: "Standard" | "High" | "Critical";
  title: string;
  requestedByName: string;
  requestedByEmail: string;
  assignedToName: string | null;
  relatedDrawingNumber: string | null;
  submittedAtUtc: string;
  updatedAtUtc: string;
}
export interface RequestEvent {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string | null;
  createdAtUtc: string;
}
export interface RequestDetail {
  id: string;
  ticketNo: string;
  type: "New" | "Modification";
  status: RequestStatus;
  priority: "Standard" | "High" | "Critical";
  title: string;
  requestedById: string;
  requestedByName: string;
  requestedByEmail: string;
  assignedToId: string | null;
  assignedToName: string | null;
  relatedDrawing: Drawing | null;
  categoryName: string | null;
  vehicleTypeName: string | null;
  makeName: string | null;
  modelName: string | null;
  capacity: string | null;
  voltageV: number | null;
  ah: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  connectorName: string | null;
  changeType: string | null;
  targetDate: string | null;
  description: string | null;
  reason: string | null;
  submittedAtUtc: string;
  updatedAtUtc: string;
  closedAtUtc: string | null;
  closureNote: string | null;
  resultDrawingId: string | null;
  resultDrawingNumber: string | null;
  resultDrawing: Drawing | null;
  attachments: {
    fileId: string;
    name: string;
    sizeBytes: number;
    url: string;
    canPreview: boolean;
  }[];
  events: RequestEvent[];
  canManage: boolean;
  isClosed: boolean;
}
export interface RequestStats {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  rejected: number;
  criticalOpen: number;
  completed30Days: number;
  avgTurnaroundDays: number;
}
export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAtUtc: string;
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  linkPath: string | null;
  isRead: boolean;
  createdAtUtc: string;
}
export interface Audit {
  id: string;
  createdAtUtc: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  detailsJson: string | null;
  ipAddress: string | null;
}
export interface BulkJob {
  id: string;
  status: "Queued" | "Running" | "Completed" | "CompletedWithErrors" | "Failed";
  fileName: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  failureMessage: string | null;
  skipDuplicates: boolean;
  autoCreateMaster: boolean;
  createdAtUtc: string;
  startedAtUtc: string | null;
  finishedAtUtc: string | null;
}
export interface Dashboard {
  totalDrawings: number;
  activeDrawings: number;
  archivedDrawings: number;
  addedThisWeek: number;
  requests: RequestStats;
  recent: RequestListItem[];
  turnaround: { label: string; avgDays: number; closed: number }[];
  activity: Audit[];
}
export interface AppSettings {
  numberMask: string;
  example: string;
  toleranceLengthMm: number;
  toleranceWidthMm: number;
  toleranceHeightMm: number;
}
