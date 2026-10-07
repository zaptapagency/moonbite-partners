export const metadata = {
  title: "Prohibited Goods · MoonBite Partners",
  description: "Prohibited Goods policy for MoonBite Partners.",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 28,
};

const liStyle: React.CSSProperties = {
  marginBottom: 8,
};

export default function ProhibitedPage() {
  return (
    <article style={{ maxWidth: 760, lineHeight: 1.6 }}>
      <div
        style={{
          border: "1px solid #6b5c1f",
          background: "#1a170c",
          color: "#e6c84a",
          borderRadius: 12,
          padding: "12px 16px",
          fontSize: 13,
        }}
      >
        <strong>Template — not legal advice.</strong> This is placeholder copy
        for a demo platform. It has not been reviewed by a lawyer. Replace it
        with a policy drafted for your jurisdiction before going live.
      </div>

      <h1 style={{ marginTop: 24 }}>Prohibited Goods policy</h1>
      <p style={{ color: "#9aa4b2" }}>
        Merchants may sell only lawful digital products. Listing or attempting to
        sell any of the following is strictly prohibited and may result in
        immediate removal and account suspension.
      </p>

      <section style={sectionStyle}>
        <h2>1. Illegal goods &amp; content</h2>
        <ul>
          <li style={liStyle}>
            Anything illegal to sell or possess in the buyer&apos;s or
            merchant&apos;s jurisdiction.
          </li>
          <li style={liStyle}>
            Stolen data, leaked databases, credentials, or personal information.
          </li>
          <li style={liStyle}>
            Content that infringes copyright, trademark, or other intellectual
            property you do not own or have a license to sell.
          </li>
          <li style={liStyle}>
            Child sexual abuse material or any content that exploits or endangers
            minors.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>2. Malware &amp; security-circumvention tools</h2>
        <ul>
          <li style={liStyle}>
            Malware, ransomware, spyware, keyloggers, or botnet tooling.
          </li>
          <li style={liStyle}>
            Exploits, cracks, keygens, or tools whose primary purpose is to
            bypass licensing, DRM, or access controls.
          </li>
          <li style={liStyle}>
            Phishing kits, carding tools, or services designed to defraud.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>3. Regulated products</h2>
        <ul>
          <li style={liStyle}>
            Products that require a license we cannot verify — including
            pharmaceuticals, controlled substances, weapons, and gambling
            services.
          </li>
          <li style={liStyle}>
            Financial, legal, medical, or tax services that require professional
            licensing or regulatory authorization.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>4. Securities-like &amp; investment products</h2>
        <ul>
          <li style={liStyle}>
            Securities, tokenized shares, or anything marketed as an investment
            contract or promising financial returns.
          </li>
          <li style={liStyle}>
            Ponzi, pyramid, matrix, or &quot;multiplier&quot; schemes, and
            guaranteed-yield programs.
          </li>
          <li style={liStyle}>
            Unlicensed money transmission, mixing, or laundering services.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>5. Deceptive or harmful offerings</h2>
        <ul>
          <li style={liStyle}>
            Counterfeits, fake reviews, engagement bots, or fraudulent
            documents.
          </li>
          <li style={liStyle}>
            Products that facilitate hate, harassment, violence, or
            discrimination.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>6. Takedown rights</h2>
        <p>
          We may remove any listing, cancel orders, and suspend or terminate
          accounts at our discretion — with or without notice — when we believe
          this policy has been violated or when required by law. We may preserve
          and disclose information in response to lawful requests. Rights
          holders may report infringing listings for takedown. Enforcement of
          this policy does not make the platform the seller of, or responsible
          for, any merchant&apos;s products.
        </p>
      </section>
    </article>
  );
}
