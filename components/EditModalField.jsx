import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FIELD_HELP_OPEN_EVENT = 'edit-modal-field-help-open';
const HELP_SCOPE_SELECTOR = '.stakeholder-edit-modal, .page-poa';

const getHelpScopeElement = (element) => {
  if (typeof document === 'undefined') return null;
  return element?.closest?.(HELP_SCOPE_SELECTOR) || document.body;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function FieldHelpButton({ text, label = 'Field guidance', className = '' }) {
  const generatedId = useId();
  const helpId = `${generatedId}-help`;
  const helpRef = useRef(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState(null);

  const updatePopoverPosition = useCallback(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const margin = 16;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const preferredWidth = className.includes('stakeholder-edit-subtitle-help') ? 320 : 300;
    const width = Math.max(180, Math.min(preferredWidth, viewportWidth - margin * 2));
    const height = popoverRef.current?.offsetHeight || 120;
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - height - 8;
    const hasRoomBelow = belowTop + height <= viewportHeight - margin;
    const hasRoomAbove = aboveTop >= margin;
    const top = hasRoomBelow || !hasRoomAbove
      ? clamp(belowTop, margin, Math.max(margin, viewportHeight - margin - Math.min(height, 180)))
      : aboveTop;

    setPopoverPosition({
      top,
      left: clamp(rect.left, margin, Math.max(margin, viewportWidth - width - margin)),
      width,
      maxHeight: Math.max(96, Math.min(180, viewportHeight - top - margin)),
    });
  }, [className, isOpen]);

  useEffect(() => {
    const closeWhenSiblingOpens = (event) => {
      const { sourceId, modalElement, scopeElement } = event.detail || {};
      const currentScopeElement = getHelpScopeElement(helpRef.current);
      const sourceScopeElement = scopeElement || modalElement;
      if (sourceId !== helpId && sourceScopeElement && sourceScopeElement === currentScopeElement) {
        setIsOpen(false);
      }
    };

    window.addEventListener(FIELD_HELP_OPEN_EVENT, closeWhenSiblingOpens);
    return () => window.removeEventListener(FIELD_HELP_OPEN_EVENT, closeWhenSiblingOpens);
  }, [helpId]);

  const toggleHelp = () => {
    if (!isOpen) {
      const scopeElement = getHelpScopeElement(helpRef.current);
      window.dispatchEvent(new CustomEvent(FIELD_HELP_OPEN_EVENT, {
        detail: {
          sourceId: helpId,
          modalElement: scopeElement?.matches?.('.stakeholder-edit-modal') ? scopeElement : null,
          scopeElement,
        },
      }));
    }
    setIsOpen((current) => !current);
  };

  useEffect(() => {
    if (!isOpen) {
      setPopoverPosition(null);
      return undefined;
    }

    updatePopoverPosition();
    const frame = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  if (!text) return null;

  return (
    <span
      ref={helpRef}
      className={`field-help ${className}${isOpen ? ' is-open' : ''}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="field-help-button"
        aria-label={label}
        aria-controls={helpId}
        aria-expanded={isOpen}
        title={text}
        onClick={toggleHelp}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <span
          id={helpId}
          ref={popoverRef}
          className="field-help-popover"
          role="tooltip"
          style={popoverPosition ? {
            position: 'fixed',
            top: `${popoverPosition.top}px`,
            right: 'auto',
            left: `${popoverPosition.left}px`,
            width: `${popoverPosition.width}px`,
            maxHeight: `${popoverPosition.maxHeight}px`,
          } : { position: 'fixed', visibility: 'hidden' }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}

export default function EditModalField({ label, help, children, className = '' }) {
  const generatedId = useId();
  const controlId = isValidElement(children) && children.props.id ? children.props.id : generatedId;
  const childHelp = isValidElement(children) ? children.props['data-field-help'] : null;
  const effectiveHelp = help || childHelp;
  const helpDescriptionId = effectiveHelp ? `${generatedId}-description` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'data-field-help': undefined,
        'aria-describedby': [children.props['aria-describedby'], helpDescriptionId].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className={`stakeholder-edit-field ${className}`.trim()}>
      <div className="stakeholder-edit-field-label-row">
        <label className="stakeholder-edit-field-label" htmlFor={controlId}>
          {label}
        </label>
        {effectiveHelp && (
          <FieldHelpButton
            className="stakeholder-edit-field-help"
            label={`${label} guidance`}
            text={effectiveHelp}
          />
        )}
      </div>
      {effectiveHelp && (
        <span id={helpDescriptionId} className="field-help-description">
          {effectiveHelp}
        </span>
      )}
      {control}
    </div>
  );
}
