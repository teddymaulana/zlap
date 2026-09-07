import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Order } from "@/lib/types";
import { formatStatus } from "@/lib/format";

// Read once per server process rather than per PDF render.
const logoBuffer = readFileSync(join(process.cwd(), "public", "zlap-logo.png"));

// Matches the print label's own paper size (0709r1.pdf's /MediaBox), ~104.8mm
// x 147.8mm — close to but not exactly A6 — so PDFs print at the same scale
// on the same stock without the printer driver rescaling either one.
export const LABEL_WIDTH_PT = 297.12;
export const LABEL_HEIGHT_PT = 419.03998;

const styles = StyleSheet.create({
  page: {
    width: LABEL_WIDTH_PT,
    height: LABEL_HEIGHT_PT,
    padding: 16,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
    paddingBottom: 6,
    marginBottom: 10,
  },
  brand: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  channel: { fontSize: 9, color: "#333333" },
  orderId: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  awb: { fontSize: 10, color: "#333333", marginBottom: 10 },
  sectionLabel: {
    fontSize: 8,
    color: "#666666",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  name: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  line: { fontSize: 10, marginBottom: 2, lineHeight: 1.3 },
  sender: { marginTop: 50 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderTopStyle: "solid",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#333333",
  },
  logo: { width: 48, height: 48, marginTop: 10 },
});

function channelLabel(channel: Order["channel"]): string {
  if (channel === "website") return "zlapcard.com";
  return (channel ?? "").toUpperCase();
}

export function OrderLabelDocument({ order, itemCount }: { order: Order; itemCount: number }) {
  return (
    <Document>
      <Page size={[LABEL_WIDTH_PT, LABEL_HEIGHT_PT]} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ZLAP CARD</Text>
          {order.channel && <Text style={styles.channel}>{channelLabel(order.channel)}</Text>}
        </View>

        <Text style={styles.orderId}>{order.order_id}</Text>
        {order.awb && <Text style={styles.awb}>AWB: {order.awb}</Text>}

        <Text style={styles.sectionLabel}>Dikirim ke</Text>
        <Text style={styles.name}>{order.customer_name || "-"}</Text>
        {order.customer_phone && <Text style={styles.line}>{order.customer_phone}</Text>}
        {order.customer_address && <Text style={styles.line}>{order.customer_address}</Text>}

        <View style={styles.sender}>
          <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Pengirim</Text>
          <Text style={styles.line}>Zlap Cards/ Zlap Collectibles</Text>
          <Text style={styles.line}>085121369155</Text>
          <Image src={{ data: logoBuffer, format: "png" }} style={styles.logo} />
        </View>

        <View style={styles.footer}>
          <Text>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </Text>
          <Text>{formatStatus(order.payment_status)}</Text>
        </View>
      </Page>
    </Document>
  );
}
