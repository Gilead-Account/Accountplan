import HomeFieldHelp from '@/components/HomeFieldHelp';

// 5-cards-max scroll behavior is enforced by CSS (see main.css under
// "Home page side panels: cap to ~5 visible cards"). Inline styles got
// overridden by media-query rules; the CSS rule uses !important to win.
//
// Clicking a card opens the team-member edit modal owned by
// Overview/index.jsx (no page navigation).
const podParticipationClass = (participation) => {
  const key = String(participation || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return key ? ` home-pod-participation--${key}` : '';
};

export default function PodUsers({ users, onEditMember }) {
  const list = users || [];

  return (
    <article className="mock-card home-panel-card home-pod-panel">
      <div className="mock-section-head">
        <h3 className="home-title-with-help">
          <span>Team Members</span>
          <HomeFieldHelp helpKey="teamMembers" label="Team Members" />
        </h3>
        <span className="home-widget-count">{list.length || 0} users</span>
      </div>
      <div className="home-widget-scroll home-pod-card-list">
        {list.map((member) => (
          <button
            key={member.id}
            className="home-pod-card"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditMember) onEditMember(member, e);
            }}
            disabled={!onEditMember}
          >
            <span className="home-card-copy">
              <strong>{member.name || 'Name not entered'}</strong>
              <small>{member.role || 'Role not entered'}</small>
            </span>
            {member.participation && (
              <span className={`home-pod-participation${podParticipationClass(member.participation)}`}>
                {member.participation}
              </span>
            )}
          </button>
        ))}
        {list.length === 0 && (
          <div className="empty-state small">No team members captured.</div>
        )}
      </div>
    </article>
  );
}
