import { useState } from 'react';
import { Search } from 'lucide-react';

const ERROR_CODES = [
  { code: '05', title: 'Do Not Honor', category: 'Bank Decline', icon: '🏦', cause: 'The issuing bank declined the transaction without a specific reason. Most common decline.', action: 'Ask customer to contact their bank to authorize the transaction, or try a different card/payment method.', template: 'Your card issuing bank has declined this transaction. This is a bank-side decision and not something Bybit can override. Please contact your bank to authorize payments to Bybit, or use an alternative payment method.' },
  { code: '14', title: 'Invalid Card Number', category: 'Input Error', icon: '❌', cause: 'Card number entered incorrectly or card number does not match bank records.', action: 'Ask customer to double-check card number. Re-enter carefully. Ensure no spaces/errors.', template: 'The card number entered appears to be invalid. Please double-check the 16-digit card number and try again. If the issue persists, please contact your bank to verify your card details.' },
  { code: '41', title: 'Lost Card', category: 'Card Status', icon: '🚨', cause: 'Card has been reported as lost by the cardholder.', action: 'Advise customer to use a different card. Do not attempt further transactions with this card.', template: 'This card has been flagged by your bank. Please use an alternative card or payment method to complete your purchase.' },
  { code: '43', title: 'Stolen Card', category: 'Card Status', icon: '🚨', cause: 'Card has been reported stolen.', action: 'Do not retry. Advise alternative payment method.', template: 'This card has been flagged by your bank. Please use an alternative card or payment method.' },
  { code: '51', title: 'Insufficient Funds', category: 'Balance', icon: '💰', cause: 'Not enough funds in the account or card limit reached.', action: 'Ask customer to check balance, or try a different card.', template: 'The transaction was declined due to insufficient funds or credit limit. Please check your available balance or use an alternative payment method.' },
  { code: '54', title: 'Expired Card', category: 'Card Status', icon: '📅', cause: 'Card expiry date has passed or was entered incorrectly.', action: 'Verify expiry date. If correct, customer needs a new card from their bank.', template: 'Your card appears to be expired or the expiry date entered is incorrect. Please check your card details or use an updated card.' },
  { code: '57', title: 'Transaction Not Permitted', category: 'Card Restrictions', icon: '⛔', cause: 'Card type not permitted for this transaction category (crypto purchase).', action: 'Many banks block crypto purchases by default. Customer must enable crypto transactions with their bank.', template: 'Your bank has restricted this card from making cryptocurrency-related purchases. Please contact your bank to enable online/crypto purchases, or use an alternative payment method such as a debit card or bank transfer.' },
  { code: '61', title: 'Exceeds Withdrawal Limit', category: 'Limits', icon: '📊', cause: 'Transaction exceeds daily/transaction limit set by card issuer.', action: 'Try a smaller amount, or advise customer to increase limits with their bank.', template: 'This transaction exceeds your card\'s daily spending limit. You can try a smaller amount or contact your bank to temporarily increase your limit.' },
  { code: '62', title: 'Restricted Card', category: 'Card Restrictions', icon: '🔒', cause: 'Card is restricted for certain transaction types or geographic regions.', action: 'Bybit is geo-restricted in some regions. If not geo-blocked, advise customer to call bank.', template: 'Your card has geographic or category restrictions that prevented this transaction. Please contact your bank or use an alternative payment method.' },
  { code: '65', title: 'Activity Limit Exceeded', category: 'Limits', icon: '🔄', cause: 'Too many transactions in a short period (velocity check).', action: 'Ask customer to wait 24 hours and try again, or use a different card.', template: 'Your card has exceeded its daily transaction frequency limit. Please try again after 24 hours or use a different payment method.' },
  { code: '91', title: 'Issuer Unavailable', category: 'Technical', icon: '🛠️', cause: 'Card issuer\'s system is temporarily down — not a card or customer issue.', action: 'Ask customer to retry in 30 minutes. If persistent, try different card.', template: 'We\'re experiencing a temporary issue connecting with your bank. This is not related to your account. Please try again in 30 minutes or use an alternative payment method.' },
  { code: 'NFS', title: 'Network / Gateway Error', category: 'Technical', icon: '🌐', cause: 'Payment gateway or network error during processing.', action: 'Ask to retry. If fails 3 times, try different browser/device or alternative payment.', template: 'A network error occurred during payment processing. Please try again. If the issue persists, try using a different browser, device, or payment method.' },
  { code: '3DS', title: '3D Secure Authentication Failed', category: '3DS', icon: '🔑', cause: 'Customer failed 3DS authentication (OTP not received, wrong code, or 3DS not enrolled).', action: 'Ensure customer\'s phone can receive SMS. Some prepaid cards don\'t support 3DS. Try 3DS-enabled card.', template: '3D Secure authentication is required for this transaction but was not completed successfully. Please ensure your mobile number is up to date with your bank, and that you\'re entering the OTP correctly. If you don\'t receive an OTP, contact your bank to enable 3D Secure on your card.' },
  { code: 'GEO', title: 'Geo-Restriction', category: 'Regional', icon: '🌍', cause: 'Bybit services or card payments not available in the customer\'s country.', action: 'Verify customer\'s country. Some countries are restricted from using Bybit (e.g., US, Canada). Advise alternative or check Bybit\'s restricted countries list.', template: 'Bybit\'s card payment services are not currently available in your region. You may be able to use alternative deposit methods such as crypto transfer or P2P trading. Please check our Help Center for available options in your region.' },
  { code: 'CVV', title: 'CVV Mismatch', category: 'Input Error', icon: '🔢', cause: 'Security code (CVV/CVC) entered does not match bank records.', action: 'Ask to re-enter the 3-digit code on the back of the card carefully.', template: 'The security code (CVV/CVC) entered does not match our records. Please re-enter the 3-digit code found on the back of your card and try again.' },
];

const CATEGORIES = ['All', ...new Set(ERROR_CODES.map(e => e.category))];

export default function CardDecline() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState(null);

  const filtered = ERROR_CODES.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.code.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.cause.toLowerCase().includes(q);
    const matchCat = category === 'All' || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg-0">💳 Card Decline</h1>
        <p className="text-sm text-fg-2">Decode card error codes and guide customers to resolution</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-bg-1 border border-border-0 focus-within:border-hero/50 rounded-xl px-4 py-3">
          <Search size={15} className="text-fg-2 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, error name, or cause..."
            className="flex-1 bg-transparent text-sm text-fg-0 placeholder-fg-2 outline-none"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-bg-1 border border-border-0 text-fg-1 text-sm rounded-xl px-4 py-3 outline-none"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(err => (
          <div key={err.code} className="bg-bg-1 border border-border-0 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === err.code ? null : err.code)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-bg-2/50 transition-colors"
            >
              <span className="text-xl w-7">{err.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-hero text-sm">{err.code}</span>
                  <span className="font-medium text-fg-0 text-sm">{err.title}</span>
                </div>
                <p className="text-xs text-fg-2">{err.category}</p>
              </div>
              <span className="text-fg-2 text-sm">{expanded === err.code ? '▲' : '▼'}</span>
            </button>
            {expanded === err.code && (
              <div className="px-5 pb-5 space-y-3 border-t border-border-0">
                <div className="bg-bg-2/50 rounded-lg p-3 mt-3">
                  <p className="text-xs text-fg-2 mb-1">Cause</p>
                  <p className="text-sm text-fg-1">{err.cause}</p>
                </div>
                <div className="bg-bg-2/50 rounded-lg p-3">
                  <p className="text-xs text-fg-2 mb-1">Agent action</p>
                  <p className="text-sm text-fg-1">{err.action}</p>
                </div>
                <div className="bg-bg-2/30 rounded-lg p-3 relative group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-fg-2">Customer message</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(err.template)}
                      className="text-xs text-fg-2 hover:text-hero transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-fg-1 leading-relaxed">{err.template}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-fg-2">
            <p className="text-lg mb-1">No results</p>
            <p className="text-sm">Try a different search term or clear filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
