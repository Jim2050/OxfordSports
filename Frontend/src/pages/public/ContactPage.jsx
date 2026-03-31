import { useState } from "react";
import toast from "react-hot-toast";
import { sendContact } from "../../api/api";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSending(true);
    try {
      await sendContact(form);
      toast.success("Message sent! We'll get back to you soon.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      toast.error("Failed to send. Please try again or call us directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>Get in Touch</h1>
          <p>We're here to help with your wholesale sportswear needs</p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          {/* Info */}
          <div className="contact-info">
            <h3>Phone</h3>
            <p>
              <a href="tel:01869228107">01869 228107</a>
            </p>

            <h3>Email</h3>
            <p>
              <a href="mailto:sales@oxfordsports.online">sales@oxfordsports.online</a>
            </p>

            <h3>Address</h3>
            <p>
              Home Farm Works
              <br />
              Clifton Road, Deddington
              <br />
              Oxon. OX15 0TP
            </p>

            <h3>Business Hours</h3>
            <p>Monday – Friday, 9:00 AM – 5:00 PM</p>

            <h3>Delivery</h3>
            <p>
              UK only
              <br />
              Flat rate: £9.99 per 30kg box
              <br />
              UK Pallet Delivery: £70.00
            </p>
          </div>

          {/* Form */}
          <form className="contact-form" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handle}
              />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handle}
              />
            </div>
            <div className="form-field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                value={form.message}
                onChange={handle}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending}
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
