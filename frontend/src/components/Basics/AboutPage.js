import React from "react";
import { Link } from "react-router-dom";
import "./AboutPage.css";

const milestones = [
  {
    year: "2015",
    title: "Humble beginnings",
    copy: "We opened our first atelier with a rack of bespoke pieces and a promise to celebrate everyday style.",
  },
  {
    year: "2018",
    title: "Supplier partnerships",
    copy: "Expanded into FabrIQ fashion through close collaborations with designer collectives across Asia and Europe.",
  },
  {
    year: "2021",
    title: "Service-first evolution",
    copy: "Launched virtual styling, custom sourcing, and fit concierge services to dress every milestone with confidence.",
  },
  {
    year: "2024",
    title: "Connected supply chain",
    copy: "Rolled out our digital storefront and unified inventory hub, giving teams real-time visibility from design to delivery.",
  },
];

const coreValues = [
  {
    icon: "🧵",
    title: "Craftsmanship",
    copy: "We obsess over fabric, fit, and finish. If it doesn’t feel incredible to wear, it doesn’t make the collection.",
  },
  {
    icon: "🤝",
    title: "Partnership",
    copy: "From boutique buyers to corporate wardrobes, we collaborate closely until every client looks and feels their best.",
  },
  {
    icon: "⚡",
    title: "Responsiveness",
    copy: "Fast fit notes, faster deliveries, and proactive alerts keep your racks ready for what’s trending next.",
  },
];

export default function AboutPage() {
  return (
    <main className="about">
      <section className="about__hero">
        <p className="eyebrow">Who we are</p>
        <h1>Dressing every story with smarter fashion</h1>
        <p className="lead">
          FabrIQ blends thoughtful design with connected logistics so your customers never miss a moment. We combine
          decades of retail experience with a forward-looking fashion platform crafted for stylists, buyers,
          and growing brands across Sri Lanka.
        </p>
        <div className="hero-actions">
          <Link to="/customer-products" className="btn btn-primary">
            Explore catalogue
          </Link>
          <a href="#values" className="btn btn-outline">
            Our values
          </a>
        </div>
      </section>

      <section className="about__grid" aria-labelledby="about-values" id="values">
        <div className="about__grid-copy">
          <h2 id="about-values">Built around your wardrobe, not our racks</h2>
          <p>
            Whether you’re curating a boutique launch or outfitting a corporate team, we keep stock moving and designs
            aligned. Our blended inventory model unifies supplier feeds, studio collections, and custom orders into a
            single source of truth so you get what you need—exactly when you need it.
          </p>
        </div>
        <ul className="about__values">
          {coreValues.map((value) => (
            <li key={value.title}>
              <span className="value-icon" aria-hidden="true">{value.icon}</span>
              <h3>{value.title}</h3>
              <p>{value.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about__timeline" aria-labelledby="about-story">
        <h2 id="about-story">A timeline of stitched-together wins</h2>
        <ol>
          {milestones.map((item) => (
            <li key={item.year}>
              <div className="timeline-year">{item.year}</div>
              <div className="timeline-card">
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="about__cta" aria-labelledby="cta-heading">
        <div className="cta-card">
          <div>
            <p className="eyebrow">Ready to partner?</p>
            <h2 id="cta-heading">Let’s style your next collection</h2>
            <p>
              Our specialists are on call to source bespoke pieces, plan recurring drops, and tailor the FabrIQ
              platform for your retail team.
            </p>
          </div>
          <div className="cta-actions">
            <Link to="/register" className="btn btn-primary">
              Create customer account
            </Link>
            <Link to="/register-supplier" className="btn btn-secondary">
              Join as supplier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
