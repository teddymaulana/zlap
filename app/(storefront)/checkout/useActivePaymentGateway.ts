"use client";

import { useEffect, useState } from "react";
import { getActivePaymentGateway } from "@/app/actions/checkout";
import type { PaymentGateway } from "@/lib/types";

// Which gateway new checkouts actually charge through — decides whether a
// checkout form shows the Midtrans PaymentMethodPicker at all (DOKU's hosted
// page handles channel selection itself). Defaults to Midtrans's
// picker-based flow while this is still loading; the server re-derives the
// gateway on submit regardless (see chargeExistingOrder).
export function useActivePaymentGateway() {
  const [gateway, setGateway] = useState<PaymentGateway>("midtrans");
  useEffect(() => {
    getActivePaymentGateway().then(setGateway);
  }, []);
  return gateway;
}
