import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Ingredient, ParsedRecipe, RecipeStep } from '../types/recipe'

const inputClass =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20'

type EditorIngredient = Ingredient & { _key: string }
type EditorStep = RecipeStep & { _key: string }
export type EditorRecipe = Omit<ParsedRecipe, 'ingredients' | 'steps'> & {
  ingredients: EditorIngredient[]
  steps: EditorStep[]
}

interface RecipeEditorProps {
  draft: EditorRecipe
  onChange: (recipe: EditorRecipe) => void
  activeTab: 'ingredients' | 'steps'
  onTabChange: (tab: 'ingredients' | 'steps') => void
}

function newKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function RecipeEditor({ draft, onChange, activeTab, onTabChange }: RecipeEditorProps) {
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeIngredient = activeIngredientId
    ? draft.ingredients.find((ing) => ing._key === activeIngredientId)
    : null

  const activeStep = activeStepId ? draft.steps.find((step) => step._key === activeStepId) : null
  const activeStepIndex = activeStep ? draft.steps.findIndex((step) => step._key === activeStepId) : -1

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    const ingredients = draft.ingredients.map((ing, i) =>
      i === index ? { ...ing, ...patch } : ing,
    )
    onChange({ ...draft, ingredients })
  }

  const removeIngredient = (index: number) => {
    onChange({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })
  }

  const addIngredient = () => {
    onChange({
      ...draft,
      ingredients: [...draft.ingredients, { name: '', quantity: '', group: 'Main', _key: newKey('ing') }],
    })
  }

  const updateStep = (index: number, instruction: string) => {
    const steps = draft.steps.map((step, i) => (i === index ? { ...step, instruction } : step))
    onChange({ ...draft, steps })
  }

  const removeStep = (index: number) => {
    onChange({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })
  }

  const addStep = () => {
    onChange({
      ...draft,
      steps: [
        ...draft.steps,
        {
          order: draft.steps.length + 1,
          instruction: '',
          ingredients_used: [],
          equipment: [],
          _key: newKey('step'),
        },
      ],
    })
  }

  const handleIngredientDragStart = (event: DragStartEvent) => {
    setActiveIngredientId(String(event.active.id))
  }

  const handleIngredientDragEnd = (event: DragEndEvent) => {
    setActiveIngredientId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = draft.ingredients.findIndex((ing) => ing._key === active.id)
    const newIndex = draft.ingredients.findIndex((ing) => ing._key === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange({ ...draft, ingredients: arrayMove(draft.ingredients, oldIndex, newIndex) })
  }

  const handleStepDragStart = (event: DragStartEvent) => {
    setActiveStepId(String(event.active.id))
  }

  const handleStepDragEnd = (event: DragEndEvent) => {
    setActiveStepId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = draft.steps.findIndex((step) => step._key === active.id)
    const newIndex = draft.steps.findIndex((step) => step._key === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const steps = arrayMove(draft.steps, oldIndex, newIndex).map((step, i) => ({
      ...step,
      order: i + 1,
    }))
    onChange({ ...draft, steps })
  }

  return (
    <>
      <div className="mt-3 flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1 lg:hidden">
        <TabButton
          active={activeTab === 'ingredients'}
          onClick={() => onTabChange('ingredients')}
          label={`Ingredients (${draft.ingredients.length})`}
        />
        <TabButton
          active={activeTab === 'steps'}
          onClick={() => onTabChange('steps')}
          label={`Steps (${draft.steps.length})`}
        />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <section
          className={[
            'flex min-h-0 flex-col rounded-2xl border border-brand-200 bg-white',
            activeTab !== 'ingredients' ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
            <div>
              <h2 className="font-semibold text-stone-900">Ingredients</h2>
              <p className="text-xs text-stone-500">Drag ≡ to reorder</p>
            </div>
            <button
              type="button"
              onClick={addIngredient}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              + Add
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleIngredientDragStart}
            onDragEnd={handleIngredientDragEnd}
            onDragCancel={() => setActiveIngredientId(null)}
          >
            <SortableContext
              items={draft.ingredients.map((ing) => ing._key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-4 py-3">
                <ul className="space-y-2">
                  {draft.ingredients.map((ing, i) => (
                    <SortableIngredientRow
                      key={ing._key}
                      id={ing._key}
                      ingredient={ing}
                      onUpdate={(patch) => updateIngredient(i, patch)}
                      onRemove={() => removeIngredient(i)}
                    />
                  ))}
                  {draft.ingredients.length === 0 && (
                    <li className="py-4 text-center text-sm text-stone-400">No ingredients yet</li>
                  )}
                </ul>
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeIngredient ? (
                <IngredientRowPreview ingredient={activeIngredient} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>

        <section
          className={[
            'flex min-h-0 flex-col rounded-2xl border border-brand-200 bg-white',
            activeTab !== 'steps' ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
            <div>
              <h2 className="font-semibold text-stone-900">Steps</h2>
              <p className="text-xs text-stone-500">Drag ≡ to reorder</p>
            </div>
            <button
              type="button"
              onClick={addStep}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              + Add
            </button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleStepDragStart}
            onDragEnd={handleStepDragEnd}
            onDragCancel={() => setActiveStepId(null)}
          >
            <SortableContext
              items={draft.steps.map((step) => step._key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-4 py-3">
                <ol className="space-y-2">
                  {draft.steps.map((step, i) => (
                    <SortableStepRow
                      key={step._key}
                      id={step._key}
                      index={i}
                      step={step}
                      onUpdate={(instruction) => updateStep(i, instruction)}
                      onRemove={() => removeStep(i)}
                    />
                  ))}
                  {draft.steps.length === 0 && (
                    <li className="py-4 text-center text-sm text-stone-400">No steps yet</li>
                  )}
                </ol>
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeStep ? (
                <StepRowPreview step={activeStep} index={activeStepIndex} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>
      </div>
    </>
  )
}

function SortableIngredientRow({
  id,
  ingredient,
  onUpdate,
  onRemove,
}: {
  id: string
  ingredient: EditorIngredient
  onUpdate: (patch: Partial<Ingredient>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex gap-2 rounded-lg"
    >
      <DragHandle attributes={attributes} listeners={listeners} />
      <input
        value={ingredient.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Ingredient"
        className={inputClass}
      />
      <input
        value={ingredient.quantity}
        onChange={(e) => onUpdate({ quantity: e.target.value })}
        placeholder="Amount"
        className={`${inputClass} max-w-[7rem]`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 px-2 text-stone-400 hover:text-red-600"
        title="Remove"
      >
        ✕
      </button>
    </li>
  )
}

function SortableStepRow({
  id,
  index,
  step,
  onUpdate,
  onRemove,
}: {
  id: string
  index: number
  step: EditorStep
  onUpdate: (instruction: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex gap-2 rounded-lg"
    >
      <DragHandle attributes={attributes} listeners={listeners} />
      <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {index + 1}
      </span>
      <textarea
        value={step.instruction}
        onChange={(e) => onUpdate(e.target.value)}
        rows={2}
        placeholder="Describe this step…"
        className={`${inputClass} min-h-[3rem] flex-1 resize-y`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 px-2 text-stone-400 hover:text-red-600"
        title="Remove"
      >
        ✕
      </button>
    </li>
  )
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: ReturnType<typeof useSortable>['listeners']
}) {
  return (
    <button
      type="button"
      className="mt-2 shrink-0 cursor-grab px-1 text-stone-400 hover:text-stone-600 active:cursor-grabbing"
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ≡
    </button>
  )
}

function IngredientRowPreview({ ingredient }: { ingredient: EditorIngredient }) {
  return (
    <li className="flex gap-2 rounded-lg bg-white shadow-xl ring-2 ring-brand-300">
      <span className="mt-2 shrink-0 px-1 text-stone-400">≡</span>
      <input
        readOnly
        value={ingredient.name}
        placeholder="Ingredient"
        className={inputClass}
        tabIndex={-1}
      />
      <input
        readOnly
        value={ingredient.quantity}
        placeholder="Amount"
        className={`${inputClass} max-w-[7rem]`}
        tabIndex={-1}
      />
      <span className="shrink-0 px-2 pt-2 text-stone-300">✕</span>
    </li>
  )
}

function StepRowPreview({ step, index }: { step: EditorStep; index: number }) {
  return (
    <li className="flex gap-2 rounded-lg bg-white shadow-xl ring-2 ring-brand-300">
      <span className="mt-2 shrink-0 px-1 text-stone-400">≡</span>
      <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {index + 1}
      </span>
      <textarea
        readOnly
        value={step.instruction}
        rows={2}
        placeholder="Describe this step…"
        className={`${inputClass} min-h-[3rem] flex-1 resize-y`}
        tabIndex={-1}
      />
      <span className="shrink-0 px-2 pt-2 text-stone-300">✕</span>
    </li>
  )
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 rounded-lg py-2 text-sm font-medium transition',
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export function cloneRecipe(recipe: ParsedRecipe): EditorRecipe {
  const cloned = JSON.parse(JSON.stringify(recipe)) as ParsedRecipe
  return {
    ...cloned,
    ingredients: cloned.ingredients.map((ing) => ({ ...ing, _key: newKey('ing') })),
    steps: cloned.steps.map((step) => ({ ...step, _key: newKey('step') })),
  }
}

export function normalizeRecipe(recipe: EditorRecipe | ParsedRecipe): ParsedRecipe {
  const ingredients = recipe.ingredients.map((ing) => {
    const { _key, ...rest } = ing as EditorIngredient
    return { ...rest, name: rest.name.trim(), quantity: rest.quantity.trim() }
  }).filter((ing) => ing.name)

  const steps = recipe.steps
    .map((step, i) => {
      const { _key, ...rest } = step as EditorStep
      return { ...rest, instruction: rest.instruction.trim(), order: i + 1 }
    })
    .filter((step) => step.instruction)

  return {
    ...recipe,
    title: recipe.title.trim() || 'Untitled recipe',
    ingredients,
    steps,
  }
}
