import { getDb, schema } from '../db';

export async function getFullStudioSnapshot() {
  const db = await getDb();

  const [
    categories,
    packages,
    addons,
    zones,
    vouchers,
    terms,
    leads,
    bookings,
    freelancers,
    crewAssignments,
    photoTasks,
    videoTasks,
    galleries,
    galleryPhotos,
    printVendors,
    printOrders,
    studioGears,
    accounts,
    invoices,
    ledger,
    users,
  ] = await Promise.all([
    db.select().from(schema.serviceCategories),
    db.select().from(schema.packages),
    db.select().from(schema.addons),
    db.select().from(schema.transportZones),
    db.select().from(schema.vouchers),
    db.select().from(schema.termsVersions),
    db.select().from(schema.leads),
    db.select().from(schema.bookings),
    db.select().from(schema.freelancerProfiles),
    db.select().from(schema.crewAssignments),
    db.select().from(schema.photoTasks),
    db.select().from(schema.videoTasks),
    db.select().from(schema.galleries),
    db.select().from(schema.galleryPhotos),
    db.select().from(schema.printVendors),
    db.select().from(schema.printOrders),
    db.select().from(schema.studioGears),
    db.select().from(schema.financialAccounts),
    db.select().from(schema.invoices),
    db.select().from(schema.ledgerTransactions),
    db.select().from(schema.users),
  ]);

  // Per-project profitability (Job Costing)
  const jobCostings = bookings.map((bk) => {
    const crew = crewAssignments.filter((c) => c.bookingId === bk.id && c.offerStatus !== 'DECLINED');
    const crewCost = crew.reduce((sum, c) => sum + c.feeAmount + c.transportAllowance, 0);

    const pTask = photoTasks.find((t) => t.bookingId === bk.id);
    const vTask = videoTasks.find((t) => t.bookingId === bk.id);
    const pkg = packages.find((p) => p.id === bk.packageId);

    const editorPhotoCost = pTask ? pTask.incentiveFee : (pkg?.photoEditorFee ?? 0);
    const editorVideoCost = vTask ? vTask.incentiveFee : (pkg?.videoEditorFee ?? 0);
    const editorCost = editorPhotoCost + editorVideoCost;

    const prints = printOrders.filter((po) => po.bookingId === bk.id);
    const printHpp = prints.reduce((sum, po) => sum + po.hppCost + po.shippingCost, 0);

    const bkInvoices = invoices.filter((i) => i.bookingId === bk.id);
    const gatewayMdr = bkInvoices.reduce((sum, i) => sum + i.gatewayFeeMdr, 0);

    const totalDirectCogs = crewCost + editorCost + printHpp + gatewayMdr;
    const grossProfit = bk.grandTotal - totalDirectCogs;
    const marginPercent = bk.grandTotal > 0 ? Math.round((grossProfit / bk.grandTotal) * 1000) / 10 : 0;

    return {
      booking: bk,
      packageName: pkg?.name ?? '-',
      crewCost,
      editorPhotoCost,
      editorVideoCost,
      editorCost,
      printHpp,
      gatewayMdr,
      totalDirectCogs,
      grossProfit,
      marginPercent,
      outstandingAr: Math.max(0, bk.grandTotal - bk.paidAmount),
    };
  });

  // Corporate Financial Metrics
  const totalCashBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const grossBookingValue = bookings.reduce((s, b) => s + b.grandTotal, 0);
  const totalCashCollected = bookings.reduce((s, b) => s + b.paidAmount, 0);
  const unearnedRevenue = bookings
    .filter((b) => !b.eventExecuted)
    .reduce((s, b) => s + b.paidAmount, 0);
  const earnedRevenue = bookings
    .filter((b) => b.eventExecuted)
    .reduce((s, b) => s + b.grandTotal, 0);
  const totalReceivables = bookings.reduce((s, b) => s + Math.max(0, b.grandTotal - b.paidAmount), 0);

  const readyCrewPayouts = crewAssignments.filter((c) => c.payoutStatus === 'READY_TO_PAY');
  const unpaidCrewReadyAmount = readyCrewPayouts.reduce((s, c) => s + c.feeAmount + c.transportAllowance, 0);

  const unpaidPhotoIncentives = photoTasks.filter((t) => t.status === 'FINALIZED' && !t.incentivePaid);
  const unpaidVideoIncentives = videoTasks.filter((t) => t.mainStatus === 'FINALIZED' && !t.incentivePaid);
  const unpaidPrintOrders = printOrders.filter((p) => !p.vendorPaid && ['SENT_TO_VENDOR', 'IN_PRODUCTION', 'ARRIVED_QC', 'READY_FOR_HANDOVER', 'SHIPPED', 'DELIVERED'].includes(p.status));
  const unpaidPrintVendorAmount = unpaidPrintOrders.reduce((s, p) => s + p.hppCost, 0);

  const opexTotal = ledger
    .filter((tx) => tx.direction === 'OUT' && tx.category.startsWith('OPEX_'))
    .reduce((s, tx) => s + tx.amount, 0);

  const executedJobProfit = jobCostings
    .filter((jc) => jc.booking.eventExecuted)
    .reduce((s, jc) => s + jc.grossProfit, 0);

  const netOperatingProfit = executedJobProfit - opexTotal;

  return {
    categories,
    packages,
    addons,
    zones,
    vouchers,
    terms,
    leads,
    bookings,
    freelancers,
    crewAssignments,
    photoTasks,
    videoTasks,
    galleries,
    galleryPhotos,
    printVendors,
    printOrders,
    studioGears,
    accounts,
    invoices,
    ledger,
    users,
    jobCostings,
    financeSummary: {
      totalCashBalance,
      grossBookingValue,
      totalCashCollected,
      unearnedRevenue,
      earnedRevenue,
      totalReceivables,
      unpaidCrewReadyAmount,
      unpaidPrintVendorAmount,
      opexTotal,
      executedJobProfit,
      netOperatingProfit,
    },
  };
}

export function evaluateDateSlot(bookings: Array<{ eventDate: string }>, dateStr: string) {
  const count = bookings.filter((b) => b.eventDate === dateStr).length;
  const maxDailyTeams = 3;
  if (count === 0) {
    return { status: 'AVAILABLE', remaining: 3, label: 'Tersedia Penuh (3 Slot Tim Lapangan)' };
  }
  if (count < maxDailyTeams) {
    return {
      status: 'LIMITED',
      remaining: maxDailyTeams - count,
      label: `Slot Terbatas (Tersisa ${maxDailyTeams - count} Tim Freelance)`,
    };
  }
  return { status: 'FULL', remaining: 0, label: 'Penuh (Fully Booked)' };
}
