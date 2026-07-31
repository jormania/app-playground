import React, { useState } from 'react';
import { Button } from '../../ds/components/Button';
import { formatCurrency } from '../lib/currency';
import TemplateEditorModal from './TemplateEditorModal';

export default function QuickTemplates({ templates = [], onApplyTemplate, onSaveTemplate, onDeleteTemplate, categories, accounts }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const activeTemplates = (isEditing ? templates : templates.filter(t => t.active !== false))
    .sort((a, b) => (a.description || '').localeCompare(b.description || ''));

  if (activeTemplates.length === 0 && !isEditing) return null;

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
        <Button variant="ghost" size="xs" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </div>

      <div className="quick-tx-container">
        {activeTemplates.map(t => (
          <button
            type="button"
            key={t.id}
            className="action-pill-btn"
            style={isEditing ? { border: '1px solid var(--color-border)', background: 'var(--color-surface)' } : {}}
            onClick={() => isEditing ? setEditingTemplate(t) : onApplyTemplate(t)}
          >
            {t.description}
          </button>
        ))}
        {isEditing && (
          <button type="button" className="action-pill-btn" onClick={() => setEditingTemplate({})} style={{ border: '1px dashed var(--color-border)', background: 'transparent' }}>
            + Add Template
          </button>
        )}
      </div>

      {editingTemplate && (
        <TemplateEditorModal
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          template={editingTemplate.id ? editingTemplate : null}
          categories={categories}
          accounts={accounts}
          onSave={async (tpl) => {
            await onSaveTemplate(tpl);
            setEditingTemplate(null);
          }}
          onDelete={async (id) => {
            await onDeleteTemplate(id);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
