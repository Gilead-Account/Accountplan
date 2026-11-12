import HomeFieldHelp from '@/components/HomeFieldHelp';

export default function ServiceLineGoals({ customerGoals, onEdit }) {
  const heading = 'Customer Goals for CAR T Service Line';
  const text = customerGoals || 'No CAR T service line customer goals captured.';
  const textLength = text.length;
  const textClassName = [
    'customer-goals-text',
    textLength > 420 ? 'is-max-length' : '',
    textLength > 260 && textLength <= 420 ? 'is-long' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className="mock-card customer-goals-card">
      <div className="mock-section-head">
        <h3 className="home-title-with-help">
          <span>{heading}</span>
          <HomeFieldHelp helpKey="customerGoals" label={heading} />
        </h3>
        <button
          type="button"
          className="mock-icon-button text-button"
          onClick={onEdit}
          disabled={!onEdit}
        >
          Edit
        </button>
      </div>
      <p className={textClassName}>{text}</p>
    </article>
  );
}
