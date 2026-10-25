import { pgTable, text, integer, bigint, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  role: text('role').notNull(), // SUPER_ADMIN | OPS_ADMIN | PHOTO_EDITOR | VIDEO_EDITOR | FREELANCER | CLIENT
  specialtyLabel: text('specialty_label').default(''),
  baseMonthlySalary: bigint('base_monthly_salary', { mode: 'number' }).notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const serviceCategories = pgTable('service_categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  defaultDpPercent: integer('default_dp_percent').notNull(),
  heroImage: text('hero_image').notNull(),
});

export const packages = pgTable('packages', {
  id: text('id').primaryKey(),
  categorySlug: text('category_slug').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  price: bigint('price', { mode: 'number' }).notNull(),
  durationHours: integer('duration_hours').notNull(),
  crewSummary: text('crew_summary').notNull(),
  editedPhotoQuota: integer('edited_photo_quota').notNull(),
  albumPhotoQuota: integer('album_photo_quota').notNull(),
  videoDeliverables: text('video_deliverables').notNull(),
  printDeliverables: text('print_deliverables').notNull(),
  slaDaysPhoto: integer('sla_days_photo').notNull(),
  slaDaysVideo: integer('sla_days_video').notNull(),
  photoEditorFee: bigint('photo_editor_fee', { mode: 'number' }).notNull(),
  videoEditorFee: bigint('video_editor_fee', { mode: 'number' }).notNull(),
  isFeatured: boolean('is_featured').notNull().default(false),
});

export const addons = pgTable('addons', {
  id: text('id').primaryKey(),
  categorySlug: text('category_slug').notNull(), // all | wedding | prewedding | wisuda | event
  name: text('name').notNull(),
  unitLabel: text('unit_label').notNull(),
  price: bigint('price', { mode: 'number' }).notNull(),
  estimatedHpp: bigint('estimated_hpp', { mode: 'number' }).notNull().default(0),
});

export const transportZones = pgTable('transport_zones', {
  id: text('id').primaryKey(),
  regionName: text('region_name').notNull(),
  transportFee: bigint('transport_fee', { mode: 'number' }).notNull(),
  requiresAccommodation: boolean('requires_accommodation').notNull().default(false),
});

export const vouchers = pgTable('vouchers', {
  code: text('code').primaryKey(),
  title: text('title').notNull(),
  discountAmount: bigint('discount_amount', { mode: 'number' }).notNull(),
  minSpend: bigint('min_spend', { mode: 'number' }).notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const termsVersions = pgTable('terms_versions', {
  id: text('id').primaryKey(),
  categorySlug: text('category_slug').notNull(),
  versionCode: text('version_code').notNull(),
  title: text('title').notNull(),
  clausesJson: text('clauses_json').notNull(),
  updatedAt: text('updated_at').notNull(),
  isCurrent: boolean('is_current').notNull().default(true),
});

export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  prospectName: text('prospect_name').notNull(),
  phone: text('phone').notNull(),
  categorySlug: text('category_slug').notNull(),
  targetDate: text('target_date').notNull(),
  source: text('source').notNull(),
  status: text('status').notNull(), // NEW | FOLLOW_UP | QUOTED | WON | LOST
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  bookingCode: text('booking_code').notNull(),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientInstagram: text('client_instagram').notNull().default(''),
  categorySlug: text('category_slug').notNull(),
  packageId: text('package_id').notNull(),
  eventTitle: text('event_title').notNull(),
  eventDate: text('event_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  venueName: text('venue_name').notNull(),
  venueCity: text('venue_city').notNull(),
  venueMapsUrl: text('venue_maps_url').notNull().default(''),
  transportZoneId: text('transport_zone_id').notNull(),
  addonsJson: text('addons_json').notNull().default('[]'),
  voucherCode: text('voucher_code').notNull().default(''),
  subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
  addonsTotal: bigint('addons_total', { mode: 'number' }).notNull().default(0),
  transportFee: bigint('transport_fee', { mode: 'number' }).notNull().default(0),
  discountAmount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
  grandTotal: bigint('grand_total', { mode: 'number' }).notNull(),
  paidAmount: bigint('paid_amount', { mode: 'number' }).notNull().default(0),
  paymentStatus: text('payment_status').notNull(), // UNPAID | WAITING_VERIFICATION | DP_PAID | PAID
  projectStatus: text('project_status').notNull(), // BOOKED | BRIEF_READY | SHOOTING_DONE | RAW_VERIFIED | CLIENT_PROOFING | POST_PRODUCTION | CLIENT_REVIEW | PRINTING | READY_DELIVERY | COMPLETED
  eventExecuted: boolean('event_executed').notNull().default(false),
  allowPortfolioPublish: boolean('allow_portfolio_publish').notNull().default(true),
  coverImage: text('cover_image').notNull(),
  termsVersionCode: text('terms_version_code').notNull(),
  signatureDataUrl: text('signature_data_url').notNull().default(''),
  signedAt: text('signed_at').notNull(),
  signedIp: text('signed_ip').notNull().default('127.0.0.1'),
  worksheetJson: text('worksheet_json').notNull().default('{}'),
  testimonialText: text('testimonial_text').notNull().default(''),
  testimonialRating: integer('testimonial_rating').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const freelancerProfiles = pgTable('freelancer_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  city: text('city').notNull(),
  grade: text('grade').notNull(), // GRADE_A | GRADE_B | JUNIOR
  primaryRole: text('primary_role').notNull(), // LEAD_PHOTO | SECOND_PHOTO | LEAD_VIDEO | DRONE_PILOT | ASSISTANT
  specialties: text('specialties').notNull(),
  gearList: text('gear_list').notNull(),
  bankName: text('bank_name').notNull(),
  bankAccountNo: text('bank_account_no').notNull(),
  bankHolder: text('bank_holder').notNull(),
  defaultFee: bigint('default_fee', { mode: 'number' }).notNull(),
  blockedDatesJson: text('blocked_dates_json').notNull().default('[]'),
  rating: text('rating').notNull().default('4.9'),
});

export const crewAssignments = pgTable('crew_assignments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  freelancerId: text('freelancer_id').notNull(),
  roleTitle: text('role_title').notNull(),
  offerStatus: text('offer_status').notNull(), // OFFERED | ACCEPTED | DECLINED
  callTime: text('call_time').notNull(),
  dresscode: text('dresscode').notNull(),
  checkinAt: text('checkin_at').notNull().default(''),
  rawStatus: text('raw_status').notNull(), // PENDING | SUBMITTED | VERIFIED
  rawStorageNote: text('raw_storage_note').notNull().default(''),
  fieldNotes: text('field_notes').notNull().default(''),
  feeAmount: bigint('fee_amount', { mode: 'number' }).notNull(),
  transportAllowance: bigint('transport_allowance', { mode: 'number' }).notNull().default(0),
  payoutStatus: text('payout_status').notNull(), // LOCKED_WAITING_RAW | READY_TO_PAY | PAID
  paidAt: text('paid_at').notNull().default(''),
});

export const photoTasks = pgTable('photo_tasks', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  editorName: text('editor_name').notNull(),
  status: text('status').notNull(), // WAITING_RAW | CULLING_PREVIEW | WAITING_CLIENT_SELECTION | EDITING_RETOUCH | ALBUM_LAYOUTING | CLIENT_REVIEW | REVISION | FINALIZED
  priority: text('priority').notNull().default('NORMAL'), // NORMAL | HIGH | EXPRESS
  slaDueDate: text('sla_due_date').notNull(),
  slaPaused: boolean('sla_paused').notNull().default(false),
  revisionCount: integer('revision_count').notNull().default(0),
  maxRevisions: integer('max_revisions').notNull().default(2),
  revisionNotes: text('revision_notes').notNull().default(''),
  incentiveFee: bigint('incentive_fee', { mode: 'number' }).notNull(),
  incentivePaid: boolean('incentive_paid').notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const videoTasks = pgTable('video_tasks', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  editorName: text('editor_name').notNull(),
  teaserStatus: text('teaser_status').notNull(), // WAITING_FOOTAGE | EDITING | READY
  teaserDueDate: text('teaser_due_date').notNull(),
  teaserUrl: text('teaser_url').notNull().default(''),
  mainStatus: text('main_status').notNull(), // WAITING_FOOTAGE | INGEST_SYNC | ROUGH_CUT | COLOR_AUDIO | CLIENT_PREVIEW | REVISION | FINALIZED
  mainDueDate: text('main_due_date').notNull(),
  previewUrl: text('preview_url').notNull().default(''),
  finalGdriveUrl: text('final_gdrive_url').notNull().default(''),
  revisionCount: integer('revision_count').notNull().default(0),
  timestampRevisionsJson: text('timestamp_revisions_json').notNull().default('[]'),
  incentiveFee: bigint('incentive_fee', { mode: 'number' }).notNull(),
  incentivePaid: boolean('incentive_paid').notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const galleries = pgTable('galleries', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  clientPin: text('client_pin').notNull(),
  guestEnabled: boolean('guest_enabled').notNull().default(true),
  watermarkActive: boolean('watermark_active').notNull().default(true),
  editQuota: integer('edit_quota').notNull(),
  albumQuota: integer('album_quota').notNull(),
  selectionSubmitted: boolean('selection_submitted').notNull().default(false),
  albumLayoutUrl: text('album_layout_url').notNull().default(''),
  albumLayoutStatus: text('album_layout_status').notNull().default('NONE'), // NONE | WAITING_APPROVAL | REVISION_REQUESTED | APPROVED
  albumRevisionNote: text('album_revision_note').notNull().default(''),
  gdriveMasterUrl: text('gdrive_master_url').notNull().default(''),
});

export const galleryPhotos = pgTable('gallery_photos', {
  id: text('id').primaryKey(),
  galleryId: text('gallery_id').notNull(),
  filename: text('filename').notNull(),
  imageUrl: text('image_url').notNull(),
  momentLabel: text('moment_label').notNull(),
  selectedForEdit: boolean('selected_for_edit').notNull().default(false),
  selectedForAlbum: boolean('selected_for_album').notNull().default(false),
  isCoverChoice: boolean('is_cover_choice').notNull().default(false),
  clientNote: text('client_note').notNull().default(''),
});

export const printVendors = pgTable('print_vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  whatsapp: text('whatsapp').notNull(),
  city: text('city').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  depositBalance: bigint('deposit_balance', { mode: 'number' }).notNull().default(0),
});

export const printOrders = pgTable('print_orders', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  vendorId: text('vendor_id').notNull(),
  itemName: text('item_name').notNull(),
  itemType: text('item_type').notNull(), // ALBUM | FRAME | CANVAS | BOX_USB
  specs: text('specs').notNull(),
  engravingText: text('engraving_text').notNull().default(''),
  printReadyUrl: text('print_ready_url').notNull().default(''),
  layoutApproved: boolean('layout_approved').notNull().default(false),
  adminOverrideNote: text('admin_override_note').notNull().default(''),
  status: text('status').notNull(), // WAITING_SELECTION | LAYOUTING | WAITING_CLIENT_APPROVAL | READY_TO_PRINT | SENT_TO_VENDOR | IN_PRODUCTION | ARRIVED_QC | REPRINT_COMPLAINT | READY_FOR_HANDOVER | SHIPPED | DELIVERED
  vendorPoNo: text('vendor_po_no').notNull().default(''),
  hppCost: bigint('hpp_cost', { mode: 'number' }).notNull(),
  vendorPaid: boolean('vendor_paid').notNull().default(false),
  orderedDate: text('ordered_date').notNull().default(''),
  estimatedReadyDate: text('estimated_ready_date').notNull().default(''),
  qcPassed: boolean('qc_passed').notNull().default(false),
  qcNotes: text('qc_notes').notNull().default(''),
  deliveryMethod: text('delivery_method').notNull().default('STUDIO_PICKUP'), // STUDIO_PICKUP | COURIER
  courierName: text('courier_name').notNull().default(''),
  trackingResi: text('tracking_resi').notNull().default(''),
  shippingCost: bigint('shipping_cost', { mode: 'number' }).notNull().default(0),
  recipientName: text('recipient_name').notNull().default(''),
  deliveredAt: text('delivered_at').notNull().default(''),
});

export const studioGears = pgTable('studio_gears', {
  id: text('id').primaryKey(),
  gearCode: text('gear_code').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  purchaseValue: bigint('purchase_value', { mode: 'number' }).notNull(),
  conditionStatus: text('condition_status').notNull(), // READY_IN_STUDIO | ON_LOAN | MAINTENANCE
  borrowedByCrew: text('borrowed_by_crew').notNull().default(''),
  borrowedBookingCode: text('borrowed_booking_code').notNull().default(''),
});

export const financialAccounts = pgTable('financial_accounts', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(), // BANK | GATEWAY | CASH | RESERVE
  accountNumber: text('account_number').notNull(),
  balance: bigint('balance', { mode: 'number' }).notNull(),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull(),
  bookingId: text('booking_id').notNull(),
  termType: text('term_type').notNull(), // DP | INSTALLMENT | FINAL_SETTLEMENT | ADDON
  description: text('description').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull(), // UNPAID | WAITING_VERIFICATION | PAID | CANCELLED
  paymentMethod: text('payment_method').notNull().default(''), // PG_QRIS | PG_VA | MANUAL_TRANSFER
  paymentChannel: text('payment_channel').notNull().default(''),
  gatewayFeeMdr: bigint('gateway_fee_mdr', { mode: 'number' }).notNull().default(0),
  proofNote: text('proof_note').notNull().default(''),
  paidAt: text('paid_at').notNull().default(''),
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: text('id').primaryKey(),
  txCode: text('tx_code').notNull(),
  txDate: text('tx_date').notNull(),
  accountId: text('account_id').notNull(),
  direction: text('direction').notNull(), // IN | OUT
  category: text('category').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  bookingId: text('booking_id').notNull().default(''),
  referenceDoc: text('reference_doc').notNull().default(''),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
});
