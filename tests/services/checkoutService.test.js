jest.mock("../../services/dbService", () => ({
  idempotencyExists: jest.fn(),
  getBookingWithDetails: jest.fn(),
  getBookingAddons: jest.fn(),
  transaction: jest.fn(),
}));

const dbService = require("../../services/dbService");
const checkoutService = require("../../services/checkoutService");

describe("checkoutService", () => {
  const user = { id: 1, name: "Reception", role: "admin" };
  const orgId = 10;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks duplicate checkout attempts via idempotency key", async () => {
    dbService.idempotencyExists.mockResolvedValue(true);

    const result = await checkoutService.processCheckout(
      1,
      { idempotency_key: "dup-key-123" },
      user,
      orgId,
    );

    expect(result).toEqual({
      success: false,
      error: "Duplicate checkout attempt blocked",
      idempotency_key: "dup-key-123",
    });
    expect(dbService.getBookingWithDetails).not.toHaveBeenCalled();
  });

  it("throws when booking is not found", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue(null);

    await expect(
      checkoutService.processCheckout(999, {}, user, orgId),
    ).rejects.toThrow("Booking not found");
  });

  it("throws when booking is already checked out", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 5,
      status: "Checked-out",
    });

    await expect(
      checkoutService.processCheckout(5, {}, user, orgId),
    ).rejects.toThrow("Booking already checked out");
  });

  it("processes checkout and returns billing summary", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 7,
      status: "Checked-in",
      check_in: "2026-06-01 14:00:00",
      check_out: "2026-06-02 11:00:00",
      price: 1500,
      kitchenTotal: 200,
      discount: 0,
      advance_paid: 500,
      customer_id: 3,
      room_id: 4,
      room_number: "101",
      category: "Deluxe",
    });
    dbService.getBookingAddons.mockResolvedValue([
      { name: "Extra Bed", price: 300 },
    ]);
    dbService.transaction.mockImplementation(async (callback) => {
      const tx = {
        run: jest.fn().mockResolvedValue({ lastID: 88 }),
        getKitchenOrdersForInvoice: jest.fn().mockResolvedValue([]),
        getBookingAddons: jest
          .fn()
          .mockResolvedValue([{ name: "Extra Bed", price: 300 }]),
      };
      return callback(tx);
    });

    const result = await checkoutService.processCheckout(
      7,
      { add_ons: [], gst_number: "33AMQPK7880E2ZO" },
      user,
      orgId,
    );

    expect(result.success).toBe(true);
    expect(result.billing_id).toBe(88);
    expect(result.summary.booking_id).toBe(7);
    expect(result.summary.stayDays).toBe(1);
    expect(result.summary.roomTotal).toBe(1500);
    expect(result.summary.kitchenTotal).toBe(200);
    expect(result.summary.addonTotal).toBe(300);
    expect(result.summary.advancePaid).toBe(500);
    expect(dbService.transaction).toHaveBeenCalled();
  });

  it("scopes idempotency check to the organization", async () => {
    dbService.idempotencyExists.mockResolvedValue(true);

    await checkoutService.processCheckout(
      1,
      { idempotency_key: "org-scoped-key" },
      user,
      orgId,
    );

    expect(dbService.idempotencyExists).toHaveBeenCalledWith(
      "org-scoped-key",
      orgId,
    );
  });

  it("does not double-count add-ons already stored on the booking", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 8,
      status: "Checked-in",
      check_in: "2026-06-01 14:00:00",
      check_out: "2026-06-02 11:00:00",
      price: 1000,
      kitchenTotal: 0,
      discount: 0,
      advance_paid: 0,
      customer_id: 1,
      room_id: 2,
      room_number: "102",
      category: "Standard",
    });
    dbService.getBookingAddons.mockResolvedValue([
      { name: "Extra Bed", price: 300 },
    ]);
    dbService.transaction.mockImplementation(async (callback) => {
      const tx = {
        run: jest.fn().mockResolvedValue({ lastID: 90 }),
        getKitchenOrdersForInvoice: jest.fn().mockResolvedValue([]),
        getBookingAddons: jest
          .fn()
          .mockResolvedValue([{ name: "Extra Bed", price: 300 }]),
      };
      return callback(tx);
    });

    const result = await checkoutService.processCheckout(
      8,
      {
        add_ons: [{ name: "Extra Bed", price: 300 }],
      },
      user,
      orgId,
    );

    expect(result.summary.addonTotal).toBe(300);
    expect(result.summary.totalAmount).toBe(1350);
  });

  it("applies checkout discount override when provided", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 9,
      status: "Checked-in",
      check_in: "2026-06-01 14:00:00",
      check_out: "2026-06-02 11:00:00",
      price: 1000,
      kitchenTotal: 0,
      discount: 50,
      advance_paid: 0,
      customer_id: 1,
      room_id: 2,
      room_number: "103",
      category: "Standard",
    });
    dbService.getBookingAddons.mockResolvedValue([]);
    dbService.transaction.mockImplementation(async (callback) => {
      const tx = {
        run: jest.fn().mockResolvedValue({ lastID: 91 }),
        getKitchenOrdersForInvoice: jest.fn().mockResolvedValue([]),
        getBookingAddons: jest.fn().mockResolvedValue([]),
      };
      return callback(tx);
    });

    const result = await checkoutService.processCheckout(
      9,
      { discount: 200 },
      user,
      orgId,
    );

    expect(result.summary.discount).toBe(200);
    expect(result.summary.finalAmount).toBe(840);
  });

  it("overrides an existing booking discount with an explicit 0", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 10,
      status: "Checked-in",
      check_in: "2026-06-01 14:00:00",
      check_out: "2026-06-02 11:00:00",
      price: 1000,
      kitchenTotal: 0,
      discount: 150,
      advance_paid: 0,
      customer_id: 1,
      room_id: 2,
      room_number: "104",
      category: "Standard",
    });
    dbService.getBookingAddons.mockResolvedValue([]);
    dbService.transaction.mockImplementation(async (callback) => {
      const tx = {
        run: jest.fn().mockResolvedValue({ lastID: 92 }),
        getKitchenOrdersForInvoice: jest.fn().mockResolvedValue([]),
        getBookingAddons: jest.fn().mockResolvedValue([]),
      };
      return callback(tx);
    });

    const result = await checkoutService.processCheckout(
      10,
      { discount: 0 },
      user,
      orgId,
    );

    expect(result.summary.discount).toBe(0);
  });

  it("logs a warning but still succeeds when provided total_amount mismatches calculated total", async () => {
    dbService.idempotencyExists.mockResolvedValue(false);
    dbService.getBookingWithDetails.mockResolvedValue({
      booking_id: 11,
      status: "Checked-in",
      check_in: "2026-06-01 14:00:00",
      check_out: "2026-06-02 11:00:00",
      price: 1000,
      kitchenTotal: 0,
      discount: 0,
      advance_paid: 0,
      customer_id: 1,
      room_id: 2,
      room_number: "105",
      category: "Standard",
    });
    dbService.getBookingAddons.mockResolvedValue([]);
    dbService.transaction.mockImplementation(async (callback) => {
      const tx = {
        run: jest.fn().mockResolvedValue({ lastID: 93 }),
        getKitchenOrdersForInvoice: jest.fn().mockResolvedValue([]),
        getBookingAddons: jest.fn().mockResolvedValue([]),
      };
      return callback(tx);
    });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await checkoutService.processCheckout(
      11,
      { total_amount: 99999 },
      user,
      orgId,
    );

    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Total mismatch (IGNORED)"),
    );

    warnSpy.mockRestore();
  });
});
