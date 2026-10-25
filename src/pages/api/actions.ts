import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../db';
import { generateId } from '../../lib/format';

export const POST: APIRoute = async ({ request, redirect }) => {
  const db = await getDb();
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  let body: Record<string, string> = {};
  if (contentType.includes('application/json')) {
    const raw = await request.json();
    for (const [k, v] of Object.entries(raw)) {
      body[k] = String(v ?? '');
    }
  } else {
    const formData = await request.formData();
    for (const [k, v] of formData.entries()) {
      body[k] = typeof v === 'string' ? v : v.name;
    }
  }

  const action = body.action || '';
  let redirectTo = body.redirectTo || '/';
  let notice = 'Perubahan berhasil disimpan.';

  const respond = (ok: boolean, message: string, extra: Record<string, unknown> = {}) => {
    if (wantsJson || contentType.includes('application/json')) {
      return new Response(JSON.stringify({ ok, message, ...extra }), {
        status: ok ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const sep = redirectTo.includes('?') ? '&' : '?';
    return redirect(`${redirectTo}${sep}notice=${encodeURIComponent(message)}`, 303);
  };

  try {
    // 1. CREATE CLIENT BOOKING + CONTRACT S&K + INVOICES + PRODUCTION TRACKS
    if (action === 'create_booking') {
      const packageId = body.packageId;
      const allPackages = await db.select().from(schema.packages);
      const pkg = allPackages.find((p) => p.id === packageId) || allPackages[0];
      const allCategories = await db.select().from(schema.serviceCategories);
      const cat = allCategories.find((c) => c.slug === pkg.categorySlug) || allCategories[0];

      const zones = await db.select().from(schema.transportZones);
      const zone = zones.find((z) => z.id === body.transportZoneId) || zones[0];

      const selectedAddonIds = (body.selectedAddons || '').split(',').filter(Boolean);
      const allAddons = await db.select().from(schema.addons);
      const pickedAddons = allAddons.filter((a) => selectedAddonIds.includes(a.id));
      const addonsTotal = pickedAddons.reduce((s, a) => s + a.price, 0);

      let discountAmount = 0;
      const voucherCode = (body.voucherCode || '').trim().toUpperCase();
      if (voucherCode) {
        const vouchers = await db.select().from(schema.vouchers);
        const found = vouchers.find((v) => v.code === voucherCode && v.isActive);
        if (found && pkg.price + addonsTotal >= found.minSpend) {
          discountAmount = found.discountAmount;
        }
      }

      const subtotal = pkg.price;
      const transportFee = zone.transportFee;
      const grandTotal = Math.max(0, subtotal + addonsTotal + transportFee - discountAmount);

      const existingBookings = await db.select().from(schema.bookings);
      const seq = String(existingBookings.length + 1).padStart(3, '0');
      const bookingId = generateId('bk');
      const bookingCode = `RV-2610-${seq}`;
      const today = new Date().toISOString().slice(0, 10);
      const nowStamp = new Date().toLocaleString('id-ID') + ' WIB';

      const allowPortfolio = body.allowPortfolioPublish !== 'false';
      const paymentPlan = body.paymentPlan || 'DP'; // DP | FULL
      const dpPercent = cat.defaultDpPercent || 35;
      const dpAmount = paymentPlan === 'FULL' ? grandTotal : Math.round((grandTotal * dpPercent) / 100);
      const remainingAmount = grandTotal - dpAmount;

      await db.insert(schema.bookings).values({
        id: bookingId,
        bookingCode,
        clientName: body.clientName || 'Klien Ruang Visual',
        clientEmail: body.clientEmail || 'client@email.com',
        clientPhone: body.clientPhone || '081200000000',
        clientInstagram: body.clientInstagram || '',
        categorySlug: pkg.categorySlug,
        packageId: pkg.id,
        eventTitle: body.eventTitle || `${cat.name} — ${body.clientName}`,
        eventDate: body.eventDate || '2026-11-20',
        startTime: body.startTime || '08:00',
        endTime: body.endTime || '16:00',
        venueName: body.venueName || ' Lokasi Acara Klien',
        venueCity: zone.regionName.split('(')[0].trim(),
        venueMapsUrl: body.venueMapsUrl || '',
        transportZoneId: zone.id,
        addonsJson: JSON.stringify(pickedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price }))),
        voucherCode,
        subtotal,
        addonsTotal,
        transportFee,
        discountAmount,
        grandTotal,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        projectStatus: 'BOOKED',
        eventExecuted: false,
        allowPortfolioPublish: allowPortfolio,
        coverImage: cat.heroImage,
        termsVersionCode: 'SK-RV-2026.2',
        signatureDataUrl: body.signatureDataUrl || 'SIGNED_DIGITAL_CONSENT',
        signedAt: nowStamp,
        signedIp: '103.28.14.90',
        worksheetJson: JSON.stringify({
          woContact: '',
          vipFamilyList: '',
          songReference: '',
          engravingText: body.clientName || '',
          shippingAddress: '',
          specialNotes: body.specialNotes || '',
        }),
        testimonialText: '',
        testimonialRating: 0,
        createdAt: today,
      });

      const dpInvoiceId = generateId('inv');
      const dpInvoiceNo = `INV/RV/2610/${seq}-${paymentPlan === 'FULL' ? 'LUNAS' : 'DP'}`;
      await db.insert(schema.invoices).values({
        id: dpInvoiceId,
        invoiceNumber: dpInvoiceNo,
        bookingId,
        termType: paymentPlan === 'FULL' ? 'FINAL_SETTLEMENT' : 'DP',
        description: `${paymentPlan === 'FULL' ? 'Pembayaran Penuh 100%' : `Booking Fee (${dpPercent}%)`} — ${pkg.name}`,
        amount: dpAmount,
        dueDate: today,
        status: 'UNPAID',
        paymentMethod: '',
        paymentChannel: '',
        gatewayFeeMdr: 0,
        proofNote: '',
        paidAt: '',
      });

      if (remainingAmount > 0) {
        await db.insert(schema.invoices).values({
          id: generateId('inv'),
          invoiceNumber: `INV/RV/2610/${seq}-PELUNASAN`,
          bookingId,
          termType: 'FINAL_SETTLEMENT',
          description: `Pelunasan Akhir — ${pkg.name}`,
          amount: remainingAmount,
          dueDate: body.eventDate || today,
          status: 'UNPAID',
          paymentMethod: '',
          paymentChannel: '',
          gatewayFeeMdr: 0,
          proofNote: '',
          paidAt: '',
        });
      }

      // Auto-spawn Photo Editor Track & Video Editor Track
      await db.insert(schema.photoTasks).values({
        id: generateId('pt'),
        bookingId,
        editorName: 'Dimas Saputra',
        status: 'WAITING_RAW',
        priority: selectedAddonIds.includes('add-sde') ? 'EXPRESS' : 'NORMAL',
        slaDueDate: body.eventDate || today,
        slaPaused: false,
        revisionCount: 0,
        maxRevisions: 2,
        revisionNotes: 'Menunggu pelaksanaan liputan Hari-H & backup file RAW kru.',
        incentiveFee: pkg.photoEditorFee,
        incentivePaid: false,
        updatedAt: today,
      });

      if (pkg.videoEditorFee > 0 || selectedAddonIds.includes('add-wisuda-reels')) {
        await db.insert(schema.videoTasks).values({
          id: generateId('vt'),
          bookingId,
          editorName: 'Kevin Mahendra',
          teaserStatus: 'WAITING_FOOTAGE',
          teaserDueDate: body.eventDate || today,
          teaserUrl: '',
          mainStatus: 'WAITING_FOOTAGE',
          mainDueDate: body.eventDate || today,
          previewUrl: '',
          finalGdriveUrl: '',
          revisionCount: 0,
          timestampRevisionsJson: '[]',
          incentiveFee: pkg.videoEditorFee || 200000,
          incentivePaid: false,
          updatedAt: today,
        });
      }

      // Auto-create Client Proofing Gallery shell
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const slug = bookingCode.toLowerCase();
      await db.insert(schema.galleries).values({
        id: generateId('gal'),
        bookingId,
        slug,
        title: `${body.eventTitle || cat.name} — ${body.clientName}`,
        clientPin: pin,
        guestEnabled: allowPortfolio,
        watermarkActive: true,
        editQuota: pkg.editedPhotoQuota,
        albumQuota: pkg.albumPhotoQuota,
        selectionSubmitted: false,
        albumLayoutUrl: '',
        albumLayoutStatus: 'NONE',
        albumRevisionNote: '',
        gdriveMasterUrl: '',
      });

      // Auto-create Print Production Ticket if package has print deliverables
      if (pkg.printDeliverables && pkg.printDeliverables !== '-') {
        await db.insert(schema.printOrders).values({
          id: generateId('po'),
          bookingId,
          vendorId: pkg.albumPhotoQuota > 0 ? 'pv-artisan' : 'pv-lumina',
          itemName: pkg.printDeliverables,
          itemType: pkg.albumPhotoQuota > 0 ? 'ALBUM' : 'FRAME',
          specs: `Sesuai standar paket ${pkg.name}`,
          engravingText: body.clientName || '',
          printReadyUrl: '',
          layoutApproved: pkg.albumPhotoQuota === 0,
          adminOverrideNote: '',
          status: 'WAITING_SELECTION',
          vendorPoNo: '',
          hppCost: pkg.albumPhotoQuota > 0 ? 1150000 : 350000,
          vendorPaid: false,
          orderedDate: '',
          estimatedReadyDate: '',
          qcPassed: false,
          qcNotes: '',
          deliveryMethod: 'STUDIO_PICKUP',
          courierName: '',
          trackingResi: '',
          shippingCost: 0,
          recipientName: body.clientName || '',
          deliveredAt: '',
        });
      }

      redirectTo = `/booking/pembayaran/${dpInvoiceId}`;
      return respond(true, `Booking ${bookingCode} berhasil dibuat! Silakan selesaikan pembayaran.`, {
        bookingCode,
        invoiceId: dpInvoiceId,
        redirectTo,
      });
    }

    // 2. AUTOMATIC PAYMENT GATEWAY SETTLEMENT (QRIS / VA WEBHOOK SIMULATION)
    if (action === 'pay_invoice_gateway') {
      const invoiceId = body.invoiceId;
      const channel = body.paymentChannel || 'Midtrans QRIS';
      const method = channel.includes('QRIS') ? 'PG_QRIS' : 'PG_VA';

      const invRows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
      const inv = invRows[0];
      if (!inv || inv.status === 'PAID') {
        return respond(true, 'Invoice ini sudah berstatus LUNAS.');
      }

      const mdr = method === 'PG_QRIS' ? Math.round(inv.amount * 0.007) : 4500;
      const nowStamp = new Date().toLocaleString('id-ID') + ' WIB';
      const today = new Date().toISOString().slice(0, 10);

      await db
        .update(schema.invoices)
        .set({
          status: 'PAID',
          paymentMethod: method,
          paymentChannel: channel,
          gatewayFeeMdr: mdr,
          proofNote: `Webhook Otomatis ${channel} Terverifikasi`,
          paidAt: nowStamp,
        })
        .where(eq(schema.invoices.id, inv.id));

      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, inv.bookingId));
      const bk = bkRows[0];
      if (bk) {
        const newPaid = Math.min(bk.grandTotal + 50000000, bk.paidAmount + inv.amount);
        const newPayStatus = newPaid >= bk.grandTotal ? 'PAID' : 'DP_PAID';
        await db
          .update(schema.bookings)
          .set({ paidAmount: newPaid, paymentStatus: newPayStatus })
          .where(eq(schema.bookings.id, bk.id));

        if (newPayStatus === 'PAID') {
          await db
            .update(schema.galleries)
            .set({ watermarkActive: false })
            .where(eq(schema.galleries.bookingId, bk.id));
        }

        // Update Midtrans account & Ledger
        const accRows = await db
          .select()
          .from(schema.financialAccounts)
          .where(eq(schema.financialAccounts.id, 'acc-midtrans'));
        if (accRows[0]) {
          await db
            .update(schema.financialAccounts)
            .set({ balance: accRows[0].balance + inv.amount - mdr })
            .where(eq(schema.financialAccounts.id, 'acc-midtrans'));
        }

        await db.insert(schema.ledgerTransactions).values([
          {
            id: generateId('tx'),
            txCode: generateId('TRX'),
            txDate: today,
            accountId: 'acc-midtrans',
            direction: 'IN',
            category: 'CLIENT_PAYMENT',
            amount: inv.amount,
            bookingId: bk.id,
            referenceDoc: inv.invoiceNumber,
            description: `Pembayaran ${channel} — ${bk.bookingCode} (${bk.clientName})`,
            createdAt: today,
          },
          {
            id: generateId('tx'),
            txCode: generateId('MDR'),
            txDate: today,
            accountId: 'acc-midtrans',
            direction: 'OUT',
            category: 'GATEWAY_MDR',
            amount: mdr,
            bookingId: bk.id,
            referenceDoc: inv.invoiceNumber,
            description: `Biaya Layanan Payment Gateway (${channel})`,
            createdAt: today,
          },
        ]);

        redirectTo = body.redirectTo || `/portal/${bk.bookingCode}`;
      }

      return respond(true, `Pembayaran ${inv.invoiceNumber} via ${channel} berhasil terverifikasi otomatis!`);
    }

    // 3. MANUAL BANK TRANSFER SUBMISSION BY CLIENT
    if (action === 'submit_manual_transfer') {
      const invoiceId = body.invoiceId;
      const senderInfo = body.senderInfo || 'Rekening Klien';
      const targetBank = body.targetBank || 'BCA Bisnis Operasional';
      const refNote = body.refNote || '';

      const invRows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
      const inv = invRows[0];
      if (!inv) return respond(false, 'Invoice tidak ditemukan.');

      await db
        .update(schema.invoices)
        .set({
          status: 'WAITING_VERIFICATION',
          paymentMethod: 'MANUAL_TRANSFER',
          paymentChannel: targetBank,
          proofNote: `Pengirim: ${senderInfo} | Catatan/Ref: ${refNote} (Diunggah ${new Date().toLocaleTimeString('id-ID')} WIB)`,
        })
        .where(eq(schema.invoices.id, inv.id));

      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, inv.bookingId));
      if (bkRows[0]) {
        if (bkRows[0].paidAmount === 0) {
          await db
            .update(schema.bookings)
            .set({ paymentStatus: 'WAITING_VERIFICATION' })
            .where(eq(schema.bookings.id, bkRows[0].id));
        }
        redirectTo = body.redirectTo || `/portal/${bkRows[0].bookingCode}`;
      }

      return respond(true, 'Bukti transfer berhasil dikirim! Admin Ruang Visual akan segera memverifikasi mutasi.');
    }

    // 4. ADMIN VERIFY MANUAL TRANSFER
    if (action === 'verify_manual_payment') {
      const invoiceId = body.invoiceId;
      const decision = body.decision || 'APPROVE'; // APPROVE | REJECT
      const invRows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
      const inv = invRows[0];
      if (!inv) return respond(false, 'Invoice tidak ditemukan.');

      if (decision === 'REJECT') {
        await db
          .update(schema.invoices)
          .set({ status: 'UNPAID', proofNote: `Ditolak Admin: Bukti belum sesuai mutasi.` })
          .where(eq(schema.invoices.id, inv.id));
        return respond(true, `Verifikasi ${inv.invoiceNumber} ditolak, dikembalikan ke status Unpaid.`);
      }

      const today = new Date().toISOString().slice(0, 10);
      const nowStamp = new Date().toLocaleString('id-ID') + ' WIB';
      const targetAccId = inv.paymentChannel.includes('Mandiri') ? 'acc-mandiri' : 'acc-bca';

      await db
        .update(schema.invoices)
        .set({
          status: 'PAID',
          paidAt: nowStamp,
          proofNote: `${inv.proofNote} — [APPROVED BY ADMIN]`,
        })
        .where(eq(schema.invoices.id, inv.id));

      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, inv.bookingId));
      const bk = bkRows[0];
      if (bk) {
        const newPaid = bk.paidAmount + inv.amount;
        const newStatus = newPaid >= bk.grandTotal ? 'PAID' : 'DP_PAID';
        await db
          .update(schema.bookings)
          .set({ paidAmount: newPaid, paymentStatus: newStatus })
          .where(eq(schema.bookings.id, bk.id));

        if (newStatus === 'PAID') {
          await db
            .update(schema.galleries)
            .set({ watermarkActive: false })
            .where(eq(schema.galleries.bookingId, bk.id));
        }

        const accRows = await db
          .select()
          .from(schema.financialAccounts)
          .where(eq(schema.financialAccounts.id, targetAccId));
        if (accRows[0]) {
          await db
            .update(schema.financialAccounts)
            .set({ balance: accRows[0].balance + inv.amount })
            .where(eq(schema.financialAccounts.id, targetAccId));
        }

        await db.insert(schema.ledgerTransactions).values({
          id: generateId('tx'),
          txCode: generateId('TRX'),
          txDate: today,
          accountId: targetAccId,
          direction: 'IN',
          category: 'CLIENT_PAYMENT',
          amount: inv.amount,
          bookingId: bk.id,
          referenceDoc: inv.invoiceNumber,
          description: `Verifikasi Transfer Manual — ${bk.bookingCode} (${bk.clientName})`,
          createdAt: today,
        });
      }

      return respond(true, `Pembayaran manual ${inv.invoiceNumber} berhasil diverifikasi & saldo bank diperbarui.`);
    }

    // 5. SAVE CLIENT EVENT WORKSHEET / BRIEF
    if (action === 'save_worksheet') {
      const bookingId = body.bookingId;
      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
      const bk = bkRows[0];
      if (!bk) return respond(false, 'Booking tidak ditemukan.');

      const worksheet = {
        woContact: body.woContact || '',
        vipFamilyList: body.vipFamilyList || '',
        songReference: body.songReference || '',
        engravingText: body.engravingText || '',
        shippingAddress: body.shippingAddress || '',
        specialNotes: body.specialNotes || '',
      };

      await db
        .update(schema.bookings)
        .set({
          worksheetJson: JSON.stringify(worksheet),
          projectStatus: bk.projectStatus === 'BOOKED' ? 'BRIEF_READY' : bk.projectStatus,
        })
        .where(eq(schema.bookings.id, bk.id));

      if (worksheet.engravingText) {
        await db
          .update(schema.printOrders)
          .set({ engravingText: worksheet.engravingText })
          .where(eq(schema.printOrders.bookingId, bk.id));
      }

      return respond(true, 'Event Worksheet & Teks Grafir Cetakan berhasil disimpan.');
    }

    // 6. SUBMIT CLIENT TESTIMONIAL
    if (action === 'submit_testimonial') {
      const bookingId = body.bookingId;
      await db
        .update(schema.bookings)
        .set({
          testimonialText: body.testimonialText || '',
          testimonialRating: Number(body.testimonialRating || 5),
        })
        .where(eq(schema.bookings.id, bookingId));
      return respond(true, 'Terima kasih atas ulasan & kepercayaan Anda kepada Ruang Visual!');
    }

    // 7. GALLERY INTERACTIVE PHOTO TOGGLE / NOTE
    if (action === 'update_gallery_photo') {
      const photoId = body.photoId;
      const field = body.field; // edit | album | cover | note
      const pRows = await db.select().from(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, photoId));
      const photo = pRows[0];
      if (!photo) return respond(false, 'Foto tidak ditemukan.');

      const galRows = await db.select().from(schema.galleries).where(eq(schema.galleries.id, photo.galleryId));
      const gal = galRows[0];
      const allPhotos = await db
        .select()
        .from(schema.galleryPhotos)
        .where(eq(schema.galleryPhotos.galleryId, photo.galleryId));

      if (field === 'edit') {
        const nextVal = !photo.selectedForEdit;
        const currentCount = allPhotos.filter((p) => p.selectedForEdit).length;
        if (nextVal && gal && currentCount >= gal.editQuota) {
          return respond(false, `Kuota pilih foto edit (${gal.editQuota} foto) sudah penuh. Gunakan tombol Tambah Kuota jika ingin memilih lebih banyak.`);
        }
        await db
          .update(schema.galleryPhotos)
          .set({ selectedForEdit: nextVal })
          .where(eq(schema.galleryPhotos.id, photoId));
      } else if (field === 'album') {
        const nextVal = !photo.selectedForAlbum;
        const currentCount = allPhotos.filter((p) => p.selectedForAlbum).length;
        if (nextVal && gal && currentCount >= gal.albumQuota) {
          return respond(false, `Kuota foto masuk album (${gal.albumQuota} foto) sudah penuh.`);
        }
        await db
          .update(schema.galleryPhotos)
          .set({ selectedForAlbum: nextVal })
          .where(eq(schema.galleryPhotos.id, photoId));
      } else if (field === 'cover') {
        for (const p of allPhotos) {
          await db
            .update(schema.galleryPhotos)
            .set({ isCoverChoice: p.id === photoId })
            .where(eq(schema.galleryPhotos.id, p.id));
        }
      } else if (field === 'note') {
        await db
          .update(schema.galleryPhotos)
          .set({ clientNote: body.clientNote || '' })
          .where(eq(schema.galleryPhotos.id, photoId));
      }

      return respond(true, 'Pilihan foto diperbarui.');
    }

    // 8. ADD EXTRA PHOTO EDIT QUOTA (+15 PHOTOS ADD-ON INVOICE)
    if (action === 'add_gallery_quota') {
      const galleryId = body.galleryId;
      const galRows = await db.select().from(schema.galleries).where(eq(schema.galleries.id, galleryId));
      const gal = galRows[0];
      if (!gal) return respond(false, 'Galeri tidak ditemukan.');

      await db
        .update(schema.galleries)
        .set({ editQuota: gal.editQuota + 15 })
        .where(eq(schema.galleries.id, gal.id));

      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, gal.bookingId));
      const bk = bkRows[0];
      if (bk) {
        const extraPrice = 450000;
        const today = new Date().toISOString().slice(0, 10);
        await db
          .update(schema.bookings)
          .set({
            addonsTotal: bk.addonsTotal + extraPrice,
            grandTotal: bk.grandTotal + extraPrice,
            paymentStatus: bk.paidAmount >= bk.grandTotal + extraPrice ? 'PAID' : 'DP_PAID',
          })
          .where(eq(schema.bookings.id, bk.id));

        await db.insert(schema.invoices).values({
          id: generateId('inv'),
          invoiceNumber: `INV/RV/ADD/${bk.bookingCode.slice(-3)}`,
          bookingId: bk.id,
          termType: 'ADDON',
          description: 'Add-on Tambahan Kuota +15 Foto Retouch dari Galeri Interaktif',
          amount: extraPrice,
          dueDate: today,
          status: 'UNPAID',
          paymentMethod: '',
          paymentChannel: '',
          gatewayFeeMdr: 0,
          proofNote: '',
          paidAt: '',
        });
      }

      return respond(true, 'Kuota pilih foto berhasil ditambah +15 foto & tagihan Add-on dibuat.');
    }

    // 9. LOCK & SUBMIT CLIENT PHOTO SELECTION -> UNPAUSE PHOTO EDITOR SLA!
    if (action === 'submit_gallery_selection') {
      const galleryId = body.galleryId;
      const galRows = await db.select().from(schema.galleries).where(eq(schema.galleries.id, galleryId));
      const gal = galRows[0];
      if (!gal) return respond(false, 'Galeri tidak ditemukan.');

      const today = new Date().toISOString().slice(0, 10);
      await db
        .update(schema.galleries)
        .set({ selectionSubmitted: true })
        .where(eq(schema.galleries.id, gal.id));

      await db
        .update(schema.photoTasks)
        .set({
          status: 'EDITING_RETOUCH',
          slaPaused: false, // Unpause SLA!
          revisionNotes: 'Klien telah mengunci pilihan foto! SLA aktif kembali untuk proses Color Grading & Retouching.',
          updatedAt: today,
        })
        .where(eq(schema.photoTasks.bookingId, gal.bookingId));

      await db
        .update(schema.bookings)
        .set({ projectStatus: 'POST_PRODUCTION' })
        .where(eq(schema.bookings.id, gal.bookingId));

      return respond(true, 'Daftar pilihan foto dikunci & langsung masuk ke antrean Editor Foto (SLA Aktif)!');
    }

    // 10. CLIENT APPROVE OR REVISE ALBUM LAYOUT -> UNLOCKS PRINT PRODUCTION!
    if (action === 'review_album_layout') {
      const galleryId = body.galleryId;
      const decision = body.decision || 'APPROVE'; // APPROVE | REVISE
      const note = body.albumRevisionNote || '';
      const galRows = await db.select().from(schema.galleries).where(eq(schema.galleries.id, galleryId));
      const gal = galRows[0];
      if (!gal) return respond(false, 'Galeri tidak ditemukan.');

      if (decision === 'APPROVE') {
        await db
          .update(schema.galleries)
          .set({ albumLayoutStatus: 'APPROVED', albumRevisionNote: note || 'Disetujui Klien untuk Naik Cetak.' })
          .where(eq(schema.galleries.id, gal.id));

        await db
          .update(schema.printOrders)
          .set({ layoutApproved: true, status: 'READY_TO_PRINT' })
          .where(eq(schema.printOrders.bookingId, gal.bookingId));

        return respond(true, 'Desain Layout Album telah Anda setujui! Status percetakan kini SIAP NAIK CETAK.');
      } else {
        await db
          .update(schema.galleries)
          .set({ albumLayoutStatus: 'REVISION_REQUESTED', albumRevisionNote: note })
          .where(eq(schema.galleries.id, gal.id));

        await db
          .update(schema.photoTasks)
          .set({ status: 'REVISION', revisionNotes: `Revisi Layout Album: ${note}` })
          .where(eq(schema.photoTasks.bookingId, gal.bookingId));

        return respond(true, 'Catatan revisi layout album telah dikirim ke Editor Foto.');
      }
    }

    // 11. CLIENT TIMESTAMPED VIDEO REVISION
    if (action === 'submit_video_revision') {
      const bookingId = body.bookingId;
      const timecode = body.timecode || '00:00';
      const note = body.revisionNote || '';
      const vRows = await db.select().from(schema.videoTasks).where(eq(schema.videoTasks.bookingId, bookingId));
      const vt = vRows[0];
      if (!vt) return respond(false, 'Task video tidak ditemukan.');

      const list = JSON.parse(vt.timestampRevisionsJson || '[]');
      list.push({ id: generateId('vrev'), timecode, note, done: false });

      await db
        .update(schema.videoTasks)
        .set({
          mainStatus: 'REVISION',
          revisionCount: vt.revisionCount + 1,
          timestampRevisionsJson: JSON.stringify(list),
          updatedAt: new Date().toISOString().slice(0, 10),
        })
        .where(eq(schema.videoTasks.id, vt.id));

      return respond(true, `Catatan revisi video pada menit ${timecode} berhasil dikirim ke Editor Video.`);
    }

    // 12. CREW FREELANCE PORTAL ACTIONS
    if (action === 'crew_respond_offer') {
      const assignmentId = body.assignmentId;
      const offerStatus = body.offerStatus || 'ACCEPTED';
      await db
        .update(schema.crewAssignments)
        .set({ offerStatus })
        .where(eq(schema.crewAssignments.id, assignmentId));
      return respond(true, `Status penawaran job diperbarui menjadi ${offerStatus}.`);
    }

    if (action === 'crew_checkin') {
      const assignmentId = body.assignmentId;
      const stamp = new Date().toLocaleString('id-ID') + ' WIB';
      await db
        .update(schema.crewAssignments)
        .set({ checkinAt: stamp })
        .where(eq(schema.crewAssignments.id, assignmentId));
      return respond(true, `Check-In kehadiran di lokasi berhasil tercatat (${stamp}).`);
    }

    if (action === 'crew_submit_raw') {
      const assignmentId = body.assignmentId;
      await db
        .update(schema.crewAssignments)
        .set({
          rawStatus: 'SUBMITTED',
          rawStorageNote: body.rawStorageNote || 'Diserahkan ke NAS Studio',
          fieldNotes: body.fieldNotes || '',
        })
        .where(eq(schema.crewAssignments.id, assignmentId));
      return respond(true, 'Laporan serah terima file RAW terkirim! Menunggu verifikasi kelengkapan file oleh Studio.');
    }

    if (action === 'crew_add_blocked_date') {
      const freelancerId = body.freelancerId;
      const dateStr = body.blockedDate;
      const fRows = await db
        .select()
        .from(schema.freelancerProfiles)
        .where(eq(schema.freelancerProfiles.id, freelancerId));
      if (fRows[0] && dateStr) {
        const dates: string[] = JSON.parse(fRows[0].blockedDatesJson || '[]');
        const updated = dates.includes(dateStr) ? dates.filter((d) => d !== dateStr) : [...dates, dateStr];
        await db
          .update(schema.freelancerProfiles)
          .set({ blockedDatesJson: JSON.stringify(updated) })
          .where(eq(schema.freelancerProfiles.id, freelancerId));
      }
      return respond(true, 'Kalender ketersediaan freelancer berhasil diperbarui.');
    }

    // 13. ADMIN CREW DISPATCH & RAW VERIFICATION GATE
    if (action === 'admin_assign_crew') {
      const bookingId = body.bookingId;
      const freelancerId = body.freelancerId;
      const fRows = await db
        .select()
        .from(schema.freelancerProfiles)
        .where(eq(schema.freelancerProfiles.id, freelancerId));
      const bkRows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
      const fr = fRows[0];
      const bk = bkRows[0];
      if (!fr || !bk) return respond(false, 'Data booking atau freelancer tidak valid.');

      const blocked: string[] = JSON.parse(fr.blockedDatesJson || '[]');
      if (blocked.includes(bk.eventDate)) {
        return respond(false, `Gagal Assign: ${fr.name} menandai tanggal ${bk.eventDate} sebagai TIDAK TERSEDIA (Blocked).`);
      }

      await db.insert(schema.crewAssignments).values({
        id: generateId('ca'),
        bookingId: bk.id,
        freelancerId: fr.id,
        roleTitle: body.roleTitle || fr.primaryRole,
        offerStatus: 'OFFERED',
        callTime: body.callTime || '07:00 WIB',
        dresscode: body.dresscode || 'Hitam Rapi Studio',
        checkinAt: '',
        rawStatus: 'PENDING',
        rawStorageNote: '',
        fieldNotes: '',
        feeAmount: Number(body.feeAmount || fr.defaultFee),
        transportAllowance: Number(body.transportAllowance || 100000),
        payoutStatus: 'LOCKED_WAITING_RAW',
        paidAt: '',
      });

      return respond(true, `Penawaran tugas berhasil dikirim ke ${fr.name}!`);
    }

    if (action === 'admin_verify_raw') {
      const assignmentId = body.assignmentId;
      const caRows = await db
        .select()
        .from(schema.crewAssignments)
        .where(eq(schema.crewAssignments.id, assignmentId));
      const ca = caRows[0];
      if (!ca) return respond(false, 'Data penugasan kru tidak ditemukan.');

      await db
        .update(schema.crewAssignments)
        .set({
          rawStatus: 'VERIFIED',
          payoutStatus: ca.payoutStatus === 'PAID' ? 'PAID' : 'READY_TO_PAY',
        })
        .where(eq(schema.crewAssignments.id, assignmentId));

      await db
        .update(schema.bookings)
        .set({ eventExecuted: true, projectStatus: 'RAW_VERIFIED' })
        .where(eq(schema.bookings.id, ca.bookingId));

      await db
        .update(schema.photoTasks)
        .set({ status: 'CULLING_PREVIEW', updatedAt: new Date().toISOString().slice(0, 10) })
        .where(eq(schema.photoTasks.bookingId, ca.bookingId));

      await db
        .update(schema.videoTasks)
        .set({
          teaserStatus: 'EDITING',
          mainStatus: 'INGEST_SYNC',
          updatedAt: new Date().toISOString().slice(0, 10),
        })
        .where(eq(schema.videoTasks.bookingId, ca.bookingId));

      return respond(true, 'Backup RAW terverifikasi aman! Fee Freelancer kini SIAP CAIR & antrean Editor Foto/Video aktif.');
    }

    // 14. DEDICATED PHOTO EDITOR WORKSPACE UPDATE
    if (action === 'update_photo_task') {
      const taskId = body.taskId;
      const nextStatus = body.status;
      const slaPaused = nextStatus === 'WAITING_CLIENT_SELECTION' || nextStatus === 'CLIENT_REVIEW';
      const today = new Date().toISOString().slice(0, 10);

      const ptRows = await db.select().from(schema.photoTasks).where(eq(schema.photoTasks.id, taskId));
      const pt = ptRows[0];
      if (!pt) return respond(false, 'Task Editor Foto tidak ditemukan.');

      await db
        .update(schema.photoTasks)
        .set({
          status: nextStatus,
          slaPaused,
          revisionNotes: body.revisionNotes ?? pt.revisionNotes,
          updatedAt: today,
        })
        .where(eq(schema.photoTasks.id, taskId));

      if (body.albumLayoutUrl) {
        await db
          .update(schema.galleries)
          .set({
            albumLayoutUrl: body.albumLayoutUrl,
            albumLayoutStatus: 'WAITING_APPROVAL',
          })
          .where(eq(schema.galleries.bookingId, pt.bookingId));
      }

      if (nextStatus === 'WAITING_CLIENT_SELECTION') {
        await db
          .update(schema.bookings)
          .set({ projectStatus: 'CLIENT_PROOFING' })
          .where(eq(schema.bookings.id, pt.bookingId));
      } else if (nextStatus === 'CLIENT_REVIEW') {
        await db
          .update(schema.bookings)
          .set({ projectStatus: 'CLIENT_REVIEW' })
          .where(eq(schema.bookings.id, pt.bookingId));
      } else if (nextStatus === 'FINALIZED') {
        await db
          .update(schema.bookings)
          .set({ projectStatus: 'PRINTING' })
          .where(eq(schema.bookings.id, pt.bookingId));
      }

      return respond(true, `Status antrean Editor Foto diperbarui ke ${nextStatus}${slaPaused ? ' (SLA Auto-Paused)' : ''}.`);
    }

    // 15. DEDICATED VIDEO EDITOR WORKSPACE UPDATE
    if (action === 'update_video_task') {
      const taskId = body.taskId;
      const vtRows = await db.select().from(schema.videoTasks).where(eq(schema.videoTasks.id, taskId));
      const vt = vtRows[0];
      if (!vt) return respond(false, 'Task Editor Video tidak ditemukan.');

      await db
        .update(schema.videoTasks)
        .set({
          teaserStatus: body.teaserStatus || vt.teaserStatus,
          teaserUrl: body.teaserUrl ?? vt.teaserUrl,
          mainStatus: body.mainStatus || vt.mainStatus,
          previewUrl: body.previewUrl ?? vt.previewUrl,
          finalGdriveUrl: body.finalGdriveUrl ?? vt.finalGdriveUrl,
          updatedAt: new Date().toISOString().slice(0, 10),
        })
        .where(eq(schema.videoTasks.id, taskId));

      if (body.finalGdriveUrl) {
        await db
          .update(schema.galleries)
          .set({ gdriveMasterUrl: body.finalGdriveUrl })
          .where(eq(schema.galleries.bookingId, vt.bookingId));
      }

      return respond(true, 'Progres pengerjaan Editor Video & tautan video berhasil diperbarui.');
    }

    if (action === 'toggle_video_revision_item') {
      const taskId = body.taskId;
      const revId = body.revId;
      const vtRows = await db.select().from(schema.videoTasks).where(eq(schema.videoTasks.id, taskId));
      const vt = vtRows[0];
      if (vt) {
        const items = JSON.parse(vt.timestampRevisionsJson || '[]').map((item: { id: string; done: boolean }) =>
          item.id === revId ? { ...item, done: !item.done } : item
        );
        await db
          .update(schema.videoTasks)
          .set({ timestampRevisionsJson: JSON.stringify(items) })
          .where(eq(schema.videoTasks.id, taskId));
      }
      return respond(true, 'Checklist revisi timestamp diperbarui.');
    }

    // 16. 8-STAGE PRINT PRODUCTION TRACKING + APPROVAL LOCK + QC + RESI
    if (action === 'update_print_order') {
      const printOrderId = body.printOrderId;
      const nextStatus = body.status;
      const poRows = await db
        .select()
        .from(schema.printOrders)
        .where(eq(schema.printOrders.id, printOrderId));
      const po = poRows[0];
      if (!po) return respond(false, 'Order percetakan tidak ditemukan.');

      const overrideNote = (body.adminOverrideNote || '').trim();
      const requiresApprovalStatuses = ['SENT_TO_VENDOR', 'IN_PRODUCTION', 'ARRIVED_QC', 'READY_FOR_HANDOVER', 'SHIPPED', 'DELIVERED'];

      if (
        po.itemType === 'ALBUM' &&
        !po.layoutApproved &&
        !overrideNote &&
        !po.adminOverrideNote &&
        requiresApprovalStatuses.includes(nextStatus)
      ) {
        return respond(
          false,
          'PRINT APPROVAL LOCK: Album belum disetujui klien di Galeri! Minta klien klik Approve Layout terlebih dahulu atau isi alasan Override Admin.'
        );
      }

      const qcPassed =
        nextStatus === 'READY_FOR_HANDOVER' || nextStatus === 'SHIPPED' || nextStatus === 'DELIVERED'
          ? true
          : nextStatus === 'REPRINT_COMPLAINT'
            ? false
            : po.qcPassed;

      const today = new Date().toISOString().slice(0, 10);
      await db
        .update(schema.printOrders)
        .set({
          vendorId: body.vendorId || po.vendorId,
          status: nextStatus,
          vendorPoNo: body.vendorPoNo ?? po.vendorPoNo,
          hppCost: body.hppCost ? Number(body.hppCost) : po.hppCost,
          orderedDate: nextStatus === 'SENT_TO_VENDOR' && !po.orderedDate ? today : po.orderedDate,
          estimatedReadyDate: body.estimatedReadyDate || po.estimatedReadyDate,
          layoutApproved: po.layoutApproved || Boolean(overrideNote),
          adminOverrideNote: overrideNote || po.adminOverrideNote,
          qcPassed,
          qcNotes: body.qcNotes ?? po.qcNotes,
          deliveryMethod: body.deliveryMethod || po.deliveryMethod,
          courierName: body.courierName ?? po.courierName,
          trackingResi: body.trackingResi ?? po.trackingResi,
          shippingCost: body.shippingCost ? Number(body.shippingCost) : po.shippingCost,
          deliveredAt: nextStatus === 'DELIVERED' ? new Date().toLocaleString('id-ID') + ' WIB' : po.deliveredAt,
        })
        .where(eq(schema.printOrders.id, po.id));

      if (nextStatus === 'READY_FOR_HANDOVER' || nextStatus === 'SHIPPED') {
        await db
          .update(schema.bookings)
          .set({ projectStatus: 'READY_DELIVERY' })
          .where(eq(schema.bookings.id, po.bookingId));
      } else if (nextStatus === 'DELIVERED') {
        await db
          .update(schema.bookings)
          .set({ projectStatus: 'COMPLETED' })
          .where(eq(schema.bookings.id, po.bookingId));
      }

      return respond(true, `Status Percetakan "${po.itemName}" diperbarui menjadi ${nextStatus}.`);
    }

    // 17. COMPLETE FINANCE: PAYOUT FREELANCE CREW FEE
    if (action === 'pay_crew_assignment') {
      const assignmentId = body.assignmentId;
      const accountId = body.accountId || 'acc-bca';
      const caRows = await db
        .select()
        .from(schema.crewAssignments)
        .where(eq(schema.crewAssignments.id, assignmentId));
      const ca = caRows[0];
      if (!ca) return respond(false, 'Penugasan kru tidak ditemukan.');
      if (ca.payoutStatus === 'LOCKED_WAITING_RAW') {
        return respond(false, 'Pencairan ditahan: File RAW belum diverifikasi aman di Studio!');
      }
      if (ca.payoutStatus === 'PAID') {
        return respond(true, 'Fee kru ini sudah dicairkan sebelumnya.');
      }

      const totalPayout = ca.feeAmount + ca.transportAllowance;
      const today = new Date().toISOString().slice(0, 10);

      const fRows = await db
        .select()
        .from(schema.freelancerProfiles)
        .where(eq(schema.freelancerProfiles.id, ca.freelancerId));
      const accRows = await db
        .select()
        .from(schema.financialAccounts)
        .where(eq(schema.financialAccounts.id, accountId));

      await db
        .update(schema.crewAssignments)
        .set({ payoutStatus: 'PAID', paidAt: today })
        .where(eq(schema.crewAssignments.id, ca.id));

      if (accRows[0]) {
        await db
          .update(schema.financialAccounts)
          .set({ balance: accRows[0].balance - totalPayout })
          .where(eq(schema.financialAccounts.id, accountId));
      }

      await db.insert(schema.ledgerTransactions).values({
        id: generateId('tx'),
        txCode: generateId('PAY-CREW'),
        txDate: today,
        accountId,
        direction: 'OUT',
        category: 'COGS_CREW_FEE',
        amount: totalPayout,
        bookingId: ca.bookingId,
        referenceDoc: `SLIP-${ca.id.toUpperCase()}`,
        description: `Pencairan Fee + Transport ${fRows[0]?.name || 'Freelancer'} (${ca.roleTitle})`,
        createdAt: today,
      });

      return respond(true, `Fee Freelance sebesar Rp ${totalPayout.toLocaleString('id-ID')} berhasil dicairkan & tercatat di Buku Besar!`);
    }

    // 18. COMPLETE FINANCE: PAY PRINT LAB VENDOR HPP
    if (action === 'pay_print_vendor') {
      const printOrderId = body.printOrderId;
      const accountId = body.accountId || 'acc-bca';
      const poRows = await db
        .select()
        .from(schema.printOrders)
        .where(eq(schema.printOrders.id, printOrderId));
      const po = poRows[0];
      if (!po || po.vendorPaid) return respond(true, 'Tagihan cetak ini sudah lunas.');

      const totalCost = po.hppCost + po.shippingCost;
      const today = new Date().toISOString().slice(0, 10);

      await db
        .update(schema.printOrders)
        .set({ vendorPaid: true })
        .where(eq(schema.printOrders.id, po.id));

      const accRows = await db
        .select()
        .from(schema.financialAccounts)
        .where(eq(schema.financialAccounts.id, accountId));
      if (accRows[0]) {
        await db
          .update(schema.financialAccounts)
          .set({ balance: accRows[0].balance - totalCost })
          .where(eq(schema.financialAccounts.id, accountId));
      }

      await db.insert(schema.ledgerTransactions).values({
        id: generateId('tx'),
        txCode: generateId('PAY-LAB'),
        txDate: today,
        accountId,
        direction: 'OUT',
        category: 'COGS_PRINTING',
        amount: totalCost,
        bookingId: po.bookingId,
        referenceDoc: po.vendorPoNo || po.id,
        description: `Pelunasan HPP Cetak & Ongkir: ${po.itemName}`,
        createdAt: today,
      });

      return respond(true, `Tagihan vendor percetakan Rp ${totalCost.toLocaleString('id-ID')} berhasil dibayarkan.`);
    }

    // 19. COMPLETE FINANCE: PAY IN-HOUSE EDITOR SALARY + PROJECT INCENTIVES
    if (action === 'pay_editor_payroll') {
      const editorRole = body.editorRole; // PHOTO_EDITOR | VIDEO_EDITOR
      const accountId = body.accountId || 'acc-bca';
      const includeBaseSalary = body.includeBaseSalary === 'true';
      const today = new Date().toISOString().slice(0, 10);

      const uRows = await db.select().from(schema.users).where(eq(schema.users.role, editorRole));
      const editor = uRows[0];
      if (!editor) return respond(false, 'Data editor tidak ditemukan.');

      let variableTotal = 0;
      if (editorRole === 'PHOTO_EDITOR') {
        const unpaid = (await db.select().from(schema.photoTasks)).filter(
          (t) => t.status === 'FINALIZED' && !t.incentivePaid
        );
        variableTotal = unpaid.reduce((s, t) => s + t.incentiveFee, 0);
        for (const t of unpaid) {
          await db.update(schema.photoTasks).set({ incentivePaid: true }).where(eq(schema.photoTasks.id, t.id));
        }
      } else {
        const unpaid = (await db.select().from(schema.videoTasks)).filter(
          (t) => t.mainStatus === 'FINALIZED' && !t.incentivePaid
        );
        variableTotal = unpaid.reduce((s, t) => s + t.incentiveFee, 0);
        for (const t of unpaid) {
          await db.update(schema.videoTasks).set({ incentivePaid: true }).where(eq(schema.videoTasks.id, t.id));
        }
      }

      const fixedAmount = includeBaseSalary ? editor.baseMonthlySalary : 0;
      const grandPayroll = fixedAmount + variableTotal;
      if (grandPayroll <= 0) {
        return respond(false, 'Tidak ada nominal gaji atau insentif selesai yang perlu dicairkan saat ini.');
      }

      const accRows = await db
        .select()
        .from(schema.financialAccounts)
        .where(eq(schema.financialAccounts.id, accountId));
      if (accRows[0]) {
        await db
          .update(schema.financialAccounts)
          .set({ balance: accRows[0].balance - grandPayroll })
          .where(eq(schema.financialAccounts.id, accountId));
      }

      if (fixedAmount > 0) {
        await db.insert(schema.ledgerTransactions).values({
          id: generateId('tx'),
          txCode: generateId('SAL-ED'),
          txDate: today,
          accountId,
          direction: 'OUT',
          category: 'OPEX_SALARY_EDITOR',
          amount: fixedAmount,
          bookingId: '',
          referenceDoc: `PAYROLL-${editor.name.split(' ')[0].toUpperCase()}`,
          description: `Gaji Pokok Bulanan ${editor.name} (${editorRole === 'PHOTO_EDITOR' ? 'Editor Foto' : 'Editor Video'})`,
          createdAt: today,
        });
      }

      if (variableTotal > 0) {
        await db.insert(schema.ledgerTransactions).values({
          id: generateId('tx'),
          txCode: generateId('INC-ED'),
          txDate: today,
          accountId,
          direction: 'OUT',
          category: 'COGS_EDITOR_INCENTIVE',
          amount: variableTotal,
          bookingId: '',
          referenceDoc: `INCENTIVE-${editor.name.split(' ')[0].toUpperCase()}`,
          description: `Komisi Project Finalized ${editor.name}`,
          createdAt: today,
        });
      }

      return respond(true, `Payroll ${editor.name} sebesar Rp ${grandPayroll.toLocaleString('id-ID')} berhasil dicairkan!`);
    }

    // 20. RECORD MANUAL OPEX / CAPEX / INTERNAL BANK TRANSFER
    if (action === 'record_ledger_expense') {
      const accountId = body.accountId || 'acc-bca';
      const direction = body.direction || 'OUT';
      const category = body.category || 'OPEX_STUDIO_RENT';
      const amount = Math.max(0, Number(body.amount || 0));
      const today = body.txDate || new Date().toISOString().slice(0, 10);

      if (amount <= 0) return respond(false, 'Nominal transaksi harus lebih dari 0.');

      const accRows = await db
        .select()
        .from(schema.financialAccounts)
        .where(eq(schema.financialAccounts.id, accountId));
      if (accRows[0]) {
        const nextBalance = direction === 'IN' ? accRows[0].balance + amount : accRows[0].balance - amount;
        await db
          .update(schema.financialAccounts)
          .set({ balance: nextBalance })
          .where(eq(schema.financialAccounts.id, accountId));
      }

      await db.insert(schema.ledgerTransactions).values({
        id: generateId('tx'),
        txCode: generateId('JRN'),
        txDate: today,
        accountId,
        direction,
        category,
        amount,
        bookingId: body.bookingId || '',
        referenceDoc: body.referenceDoc || 'MANUAL-JRN',
        description: body.description || 'Transaksi Operasional Studio',
        createdAt: today,
      });

      return respond(true, 'Jurnal transaksi berhasil dicatat ke Buku Besar.');
    }

    if (action === 'transfer_between_accounts') {
      const fromId = body.fromAccountId;
      const toId = body.toAccountId;
      const amount = Math.max(0, Number(body.amount || 0));
      const today = new Date().toISOString().slice(0, 10);
      if (!fromId || !toId || fromId === toId || amount <= 0) {
        return respond(false, 'Pilih rekening asal & tujuan yang berbeda dengan nominal valid.');
      }

      const allAcc = await db.select().from(schema.financialAccounts);
      const fromAcc = allAcc.find((a) => a.id === fromId);
      const toAcc = allAcc.find((a) => a.id === toId);
      if (!fromAcc || !toAcc) return respond(false, 'Rekening tidak ditemukan.');

      await db
        .update(schema.financialAccounts)
        .set({ balance: fromAcc.balance - amount })
        .where(eq(schema.financialAccounts.id, fromId));
      await db
        .update(schema.financialAccounts)
        .set({ balance: toAcc.balance + amount })
        .where(eq(schema.financialAccounts.id, toId));

      await db.insert(schema.ledgerTransactions).values([
        {
          id: generateId('tx'),
          txCode: generateId('TRF-OUT'),
          txDate: today,
          accountId: fromId,
          direction: 'OUT',
          category: 'INTERNAL_TRANSFER',
          amount,
          bookingId: '',
          referenceDoc: 'MUTASI-KAS',
          description: `Mutasi Keluar ke ${toAcc.name}: ${body.notes || 'Alokasi Kas'}`,
          createdAt: today,
        },
        {
          id: generateId('tx'),
          txCode: generateId('TRF-IN'),
          txDate: today,
          accountId: toId,
          direction: 'IN',
          category: 'INTERNAL_TRANSFER',
          amount,
          bookingId: '',
          referenceDoc: 'MUTASI-KAS',
          description: `Mutasi Masuk dari ${fromAcc.name}: ${body.notes || 'Alokasi Kas'}`,
          createdAt: today,
        },
      ]);

      return respond(true, `Mutasi Rp ${amount.toLocaleString('id-ID')} dari ${fromAcc.name} ke ${toAcc.name} berhasil.`);
    }

    // 21. CRM LEADS & STUDIO GEAR LOANS
    if (action === 'create_lead') {
      await db.insert(schema.leads).values({
        id: generateId('ld'),
        prospectName: body.prospectName || 'Calon Klien',
        phone: body.phone || '-',
        categorySlug: body.categorySlug || 'wedding',
        targetDate: body.targetDate || '2026-12-01',
        source: body.source || 'Website Inquiry',
        status: 'NEW',
        notes: body.notes || '',
        createdAt: new Date().toISOString().slice(0, 10),
      });
      return respond(true, 'Data prospek / inquiry baru tercatat di CRM Ruang Visual.');
    }

    if (action === 'update_lead_status') {
      await db
        .update(schema.leads)
        .set({ status: body.status || 'FOLLOW_UP' })
        .where(eq(schema.leads.id, body.leadId));
      return respond(true, 'Status prospek CRM diperbarui.');
    }

    if (action === 'toggle_gear_loan') {
      const gearId = body.gearId;
      const gRows = await db.select().from(schema.studioGears).where(eq(schema.studioGears.id, gearId));
      const g = gRows[0];
      if (g) {
        const returning = g.conditionStatus === 'ON_LOAN';
        await db
          .update(schema.studioGears)
          .set({
            conditionStatus: returning ? 'READY_IN_STUDIO' : 'ON_LOAN',
            borrowedByCrew: returning ? '' : body.borrowedByCrew || 'Crew Lapangan',
            borrowedBookingCode: returning ? '' : body.borrowedBookingCode || 'RV-ACTIVE',
          })
          .where(eq(schema.studioGears.id, gearId));
      }
      return respond(true, 'Status peminjaman inventaris alat studio diperbarui.');
    }

    return respond(false, `Aksi "${action}" tidak dikenali.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
    return respond(false, msg);
  }
};
