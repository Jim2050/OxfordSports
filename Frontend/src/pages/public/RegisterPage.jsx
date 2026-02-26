import { Link } from "react-router-dom";

export default function RegisterPage() {
  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>Register / Sign In</h1>
          <p>Members-only access to wholesale prices</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="members-gate">
            <h2>Members Only</h2>
            <p>
              To access our wholesale prices and place orders, please contact us
              directly to register as a trade buyer.
            </p>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.9rem",
                marginBottom: "1.5rem",
              }}
            >
              Call{" "}
              <a
                href="tel:01869228107"
                style={{ color: "#1a1281", fontWeight: 600 }}
              >
                01869 228107
              </a>{" "}
              or email{" "}
              <a
                href="mailto:sales@oxfordsports.net"
                style={{ color: "#1a1281", fontWeight: 600 }}
              >
                sales@oxfordsports.net
              </a>
            </p>
            <Link to="/contact" className="btn btn-primary">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
