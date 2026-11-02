import kiteLoaderHtml from '@/assets/kite-loader.html?raw';

const KITE_LOADER_DOC = kiteLoaderHtml
  .replace(/<button\s+class="replay"[\s\S]*?<\/button>/i, '')
  .replace(/<script>[\s\S]*?<\/script>/i, '')
  .replace(
    '</style>',
    `
  .kite-loader {
    position: absolute;
  }
  </style>`,
  );

export default function KiteAccountPlanLoader() {
  return (
    <div className="account-plan-kite-loader" role="status" aria-label="Loading account plans">
      <iframe
        className="account-plan-kite-loader-frame"
        title="Loading account plans"
        srcDoc={KITE_LOADER_DOC}
        sandbox=""
      />
    </div>
  );
}
