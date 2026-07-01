const { requireOrg } = require("../../middleware/org");

jest.mock("../../utils/orgScope", () => ({
  requireOrgId: jest.fn(),
}));

const { requireOrgId } = require("../../utils/orgScope");

describe("requireOrg middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets req.orgId and calls next when org is present", () => {
    requireOrgId.mockReturnValue(12);

    const req = { user: { org_id: 12 } };
    const res = {};
    const next = jest.fn();

    requireOrg(req, res, next);

    expect(req.orgId).toBe(12);
    expect(next).toHaveBeenCalled();
  });

  it("stops the chain when org is missing", () => {
    requireOrgId.mockReturnValue(null);

    const req = { user: { id: 1 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireOrg(req, res, next);

    expect(req.orgId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});
