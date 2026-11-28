import { apiPath } from "sanapp-common-ui";

/**
 * Pre-login institute identity banner directly below the sticky navy topbar,
 * mirroring the Academics Management System header branding band.
 */
export default function InstituteBand() {
  return (
    <section className="iipe-institute-band" aria-label="Institute identity">
      <div className="iipe-institute-band-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={apiPath("/img/iipe-logo.png")}
          alt="IIPE Logo"
          className="iipe-institute-band-logo"
        />
        <div className="iipe-institute-band-text">
          <div className="iipe-institute-band-native">
            భారతీయ పెట్రోలియం మరియు శక్తి విజ్ఞాన సంస్థ
          </div>
          <div className="iipe-institute-band-native">
            भारतीय पेट्रोलियम और ऊर्जा संस्थान
          </div>
          <div className="iipe-institute-band-title">
            INDIAN INSTITUTE OF PETROLEUM AND ENERGY
          </div>
          <div className="iipe-institute-band-addr">
            Vangali, Sabbavaram, Distt. Anakapalli, Andhra Pradesh – 531035
          </div>
          <div className="iipe-institute-band-tag">
            (An Institute of National Importance by an Act of Parliament)
          </div>
        </div>
      </div>
    </section>
  );
}
