import {
  buildMbiteNetwork,
  logEffectiveMbiteNetwork,
  MBITE_NETWORK_DEFAULTS,
  __resetMbiteNetworkLogOnce,
} from "./mbite.network";

describe("buildMbiteNetwork — env configurability", () => {
  it("falls back to the placeholder defaults when no env is set", () => {
    const net = buildMbiteNetwork({});
    expect(net.bech32).toBe(MBITE_NETWORK_DEFAULTS.bech32);
    expect(net.pubKeyHash).toBe(MBITE_NETWORK_DEFAULTS.pubKeyHash);
    expect(net.scriptHash).toBe(MBITE_NETWORK_DEFAULTS.scriptHash);
    expect(net.wif).toBe(MBITE_NETWORK_DEFAULTS.wif);
    expect(net.bip32.public).toBe(MBITE_NETWORK_DEFAULTS.bip32Public);
    expect(net.bip32.private).toBe(MBITE_NETWORK_DEFAULTS.bip32Private);
  });

  it("reads every field from the environment, parsing hex byte values", () => {
    const net = buildMbiteNetwork({
      MBITE_MESSAGE_PREFIX: "\x18Bitcoin Signed Message:\n",
      MBITE_BECH32_HRP: "moon",
      MBITE_PUBKEYHASH: "0x32",
      MBITE_SCRIPTHASH: "0x05",
      MBITE_WIF: "0x80",
      MBITE_BIP32_PUBLIC: "0x0488b21e",
      MBITE_BIP32_PRIVATE: "0x0488ade4",
    });
    expect(net.messagePrefix).toBe("\x18Bitcoin Signed Message:\n");
    expect(net.bech32).toBe("moon");
    expect(net.pubKeyHash).toBe(0x32);
    expect(net.scriptHash).toBe(0x05);
    expect(net.wif).toBe(0x80);
    expect(net.bip32.public).toBe(0x0488b21e);
    expect(net.bip32.private).toBe(0x0488ade4);
  });

  it("accepts hex byte values without a 0x prefix", () => {
    const net = buildMbiteNetwork({ MBITE_PUBKEYHASH: "4c", MBITE_BIP32_PUBLIC: "019da462" });
    expect(net.pubKeyHash).toBe(0x4c);
    expect(net.bip32.public).toBe(0x019da462);
  });

  it("ignores blank / invalid values and keeps the default", () => {
    const net = buildMbiteNetwork({ MBITE_BECH32_HRP: "  ", MBITE_PUBKEYHASH: "zzz" });
    expect(net.bech32).toBe(MBITE_NETWORK_DEFAULTS.bech32);
    expect(net.pubKeyHash).toBe(MBITE_NETWORK_DEFAULTS.pubKeyHash);
  });
});

describe("logEffectiveMbiteNetwork", () => {
  beforeEach(() => __resetMbiteNetworkLogOnce());

  it("emits the loud placeholder warning when defaults are in effect", () => {
    const logger = { warn: jest.fn(), info: jest.fn() };
    logEffectiveMbiteNetwork(buildMbiteNetwork({}), logger);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0]).toMatch(/PLACEHOLDER/);
  });

  it("logs at info (no warning) when params are overridden", () => {
    const logger = { warn: jest.fn(), info: jest.fn() };
    const net = buildMbiteNetwork({
      MBITE_BECH32_HRP: "moon",
      MBITE_PUBKEYHASH: "0x32",
      MBITE_SCRIPTHASH: "0x05",
      MBITE_WIF: "0x80",
      MBITE_BIP32_PUBLIC: "0x019da462",
      MBITE_BIP32_PRIVATE: "0x019d9cfe",
    });
    logEffectiveMbiteNetwork(net, logger);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("only logs once per process", () => {
    const logger = { warn: jest.fn(), info: jest.fn() };
    logEffectiveMbiteNetwork(buildMbiteNetwork({}), logger);
    logEffectiveMbiteNetwork(buildMbiteNetwork({}), logger);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
