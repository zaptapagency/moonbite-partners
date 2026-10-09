export const metadata = {
  title: "Terms of Service · MoonBite Partners",
  description: "Terms of Service for MoonBite Partners.",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 28,
};

export default function TermsPage() {
  return (
    <article style={{ maxWidth: 760, lineHeight: 1.6 }}>
      <div className="banner banner-warn" style={{ fontSize: 13 }}>
        <strong>Template — not legal advice.</strong> This is placeholder copy
        for a demo platform. It has not been reviewed by a lawyer. Replace it
        with terms drafted for your jurisdiction before going live.
      </div>

      <h1 className="h1" style={{ marginTop: 24 }}>Terms of Service</h1>
      <p className="muted">Last updated: template version.</p>

      <section style={sectionStyle}>
        <h2 className="h2">1. The platform</h2>
        <p>
          MoonBite Partners (&quot;the platform&quot;, &quot;we&quot;) is a
          marketplace that lets independent merchants sell digital products
          priced and paid in MBITE. We provide hosting, checkout, on-chain
          payment detection, and delivery tooling. The merchant — not the
          platform — is the seller of record for every product.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">2. Payments are final</h2>
        <p>
          MBITE payments are cryptocurrency transactions. Once a payment is
          broadcast and confirmed on-chain, it is irreversible. There are no
          chargebacks and the platform cannot reverse, freeze, or claw back a
          settled payment. Please verify the amount and destination address
          before sending.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">3. Refunds are merchant-driven</h2>
        <p>
          Because payments settle directly and non-custodially, any refund is
          issued at the merchant&apos;s discretion by sending MBITE back to the
          buyer&apos;s return address. The platform does not hold buyer funds
          and cannot force, guarantee, or process a refund on a merchant&apos;s
          behalf. Refund requests, eligibility, and timing are governed by the
          individual merchant&apos;s policy. If a refund is issued, it settles
          on-chain and may take several confirmations to appear.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">4. Platform fees</h2>
        <p>
          The platform charges merchants a fee on completed sales, expressed in
          basis points and shown on the merchant dashboard (for example, a fee
          of 250 bps equals 2.50% of the order total). Fees vary by merchant
          verification tier. Buyers pay only the quoted invoice total; the
          platform fee is settled out of the merchant&apos;s proceeds. Fees may
          change on notice to merchants.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">5. Non-custodial disclaimer</h2>
        <p>
          The platform is non-custodial. Orders are paid to freshly derived
          addresses controlled by the merchant&apos;s own wallet (via their
          configured settlement xpub). At no point does the platform take
          custody of, control, or have the ability to spend buyer or merchant
          funds. You are solely responsible for the security of your wallet,
          keys, and recovery phrases. The platform is not a bank, money
          transmitter, exchange, or custodian, and provides no financial,
          investment, or tax advice.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">6. Acceptable use</h2>
        <p>
          You agree not to use the platform for anything unlawful or prohibited.
          Merchants must comply with our{" "}
          <a href="/prohibited" style={{ fontWeight: 700 }}>
            Prohibited Goods policy
          </a>
          . We may suspend accounts, remove listings, and cooperate with
          lawful requests at our discretion.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">7. No warranty &amp; limitation of liability</h2>
        <p>
          The platform is provided &quot;as is&quot; without warranties of any
          kind. Products are sold by merchants; disputes about a product&apos;s
          quality, fitness, or delivery are between the buyer and the merchant.
          To the maximum extent permitted by law, the platform is not liable
          for indirect or consequential losses, or for losses arising from
          blockchain network conditions, wallet errors, or merchant conduct.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 className="h2">8. Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of the
          platform after an update constitutes acceptance of the revised terms.
        </p>
      </section>
    </article>
  );
}
