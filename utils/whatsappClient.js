/**
 * Sends an outbound WhatsApp message via Meta's Cloud API.
 * Falls back to a simulated console log if WHATSAPP_ACCESS_TOKEN or
 * WHATSAPP_PHONE_NUMBER_ID aren't set - useful for local dev/testing
 * without a real WhatsApp Business number connected yet.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
async function sendWhatsAppMessage(toPhoneNumber, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

  if (!accessToken || !phoneNumberId) {
    console.log(`[WhatsApp SIMULATED SEND] -> ${toPhoneNumber}: ${text}`);
    return { simulated: true };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      type: 'text',
      text: { body: text }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    // Meta's error responses look like { error: { message, type, code, ... } }
    const errMsg = data?.error?.message || 'WhatsApp API request failed';
    console.error('[WhatsApp API error]', data);
    throw new Error(errMsg);
  }

  return data;
}

module.exports = { sendWhatsAppMessage };
