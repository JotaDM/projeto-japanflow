import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarEvent } from '@/types';
import { addDays, endOfWeek, format, isWithinInterval, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CalendarDays, Clock, Bell, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AICalendarCreator from '@/components/AICalendarCreator';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface EmployeeCalendarProps {
  userId: string;
}

const getEventColor = (event: CalendarEvent) => {
  if (event.type === 'reminder')
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      border: 'border-yellow-400',
      text: 'text-yellow-700 dark:text-yellow-300',
      dot: 'bg-yellow-400',
    };
  if (event.targetMode === 'all')
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-red-400',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-400',
    };
  if (event.targetMode === 'sector')
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      border: 'border-blue-400',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-400',
    };
  return {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-400',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-400',
  };
};

const EmployeeCalendar = ({ userId }: EmployeeCalendarProps) => {
  const {
    currentUser,
    getEventsForUser,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    users,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [eventType, setEventType] = useState<'event' | 'reminder'>('event');

  type PostIt = { id: string; date: string; text: string };
  const noteKey = `jf:calendar-postits:v1:${userId}`;
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [noteText, setNoteText] = useState('');
  useEffect(() => {
    let cancelled = false;
    const safeNotes = (data: unknown): PostIt[] =>
      Array.isArray(data)
        ? data
            .filter(
              (item): item is PostIt =>
                !!item &&
                typeof item.id === 'string' &&
                typeof item.date === 'string' &&
                typeof item.text === 'string' &&
                item.text.length <= 400
            )
            .slice(0, 100)
        : [];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(noteKey) || '[]');
      setPostIts(
        Array.isArray(saved)
          ? saved.filter(
              (item): item is PostIt =>
                !!item &&
                typeof item.id === 'string' &&
                typeof item.date === 'string' &&
                typeof item.text === 'string'
            )
          : []
      );
    } catch {
      setPostIts([]);
    }
    if (auth.currentUser && userId) {
      getDoc(doc(db, 'user_calendar_notes', userId))
        .then((snapshot) => {
          if (!cancelled && snapshot.exists()) setPostIts(safeNotes(snapshot.data().notes));
        })
        .catch(() => {
          /* Usar anotacoes locais em caso de erro. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [noteKey]);
  const saveNotes = (next: PostIt[]) => {
    try {
      localStorage.setItem(noteKey, JSON.stringify(next));
      setPostIts(next);
      if (auth.currentUser)
        void setDoc(doc(db, 'user_calendar_notes', userId), { notes: next, schema: 1 }).catch(() =>
          toast.error('Anotação salva apenas neste navegador.')
        );
    } catch {
      toast.error('Não foi possível salvar a anotação.');
    }
  };
  const addPostIt = () => {
    const text = noteText.trim();
    if (!selectedDate || !text) return;
    if (text.length > 400 || postIts.length >= 100) {
      toast.error('Limite de anotações atingido.');
      return;
    }
    const next = [
      ...postIts,
      { id: crypto.randomUUID(), date: format(selectedDate, 'yyyy-MM-dd'), text },
    ];
    try {
      localStorage.setItem(noteKey, JSON.stringify(next));
      setPostIts(next);
      if (auth.currentUser)
        void setDoc(doc(db, 'user_calendar_notes', userId), { notes: next, schema: 1 }).catch(() =>
          toast.error('Anotação salva apenas neste navegador.')
        );
      setNoteText('');
    } catch {
      toast.error('Não foi possível salvar a anotação.');
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const events = getEventsForUser(userId);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const eventsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    return events
      .filter((event) => {
        if (viewMode === 'day' || viewMode === 'month') return event.date === selectedDateStr;
        const date = new Date(`${event.date}T12:00:00`);
        if (Number.isNaN(date.getTime())) return false;
        if (viewMode === 'week') return isWithinInterval(date, { start: weekStart, end: weekEnd });
        return date >= new Date(`${selectedDateStr}T00:00:00`);
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }, [events, selectedDate, selectedDateStr, viewMode]);

  // Group dates by their dominant color for calendar modifiers
  const { reminderDates, allDates, sectorDates, specificDates } = useMemo(() => {
    const reminder: Date[] = [];
    const all: Date[] = [];
    const sector: Date[] = [];
    const specific: Date[] = [];
    const seen = {
      reminder: new Set<string>(),
      all: new Set<string>(),
      sector: new Set<string>(),
      specific: new Set<string>(),
    };

    events.forEach((e) => {
      const dateStr = e.date;
      if (e.type === 'reminder' && !seen.reminder.has(dateStr)) {
        seen.reminder.add(dateStr);
        reminder.push(new Date(dateStr + 'T12:00:00'));
      } else if (e.targetMode === 'all' && !seen.all.has(dateStr)) {
        seen.all.add(dateStr);
        all.push(new Date(dateStr + 'T12:00:00'));
      } else if (e.targetMode === 'sector' && !seen.sector.has(dateStr)) {
        seen.sector.add(dateStr);
        sector.push(new Date(dateStr + 'T12:00:00'));
      } else if (
        e.targetMode === 'specific' &&
        e.type !== 'reminder' &&
        !seen.specific.has(dateStr)
      ) {
        seen.specific.add(dateStr);
        specific.push(new Date(dateStr + 'T12:00:00'));
      }
    });
    return { reminderDates: reminder, allDates: all, sectorDates: sector, specificDates: specific };
  }, [events]);

  const canEditEvent = (event: CalendarEvent) => {
    if (isAdmin) return true;
    return event.createdBy === currentUser?.id;
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Informe o título');
      return;
    }
    if (!selectedDateStr) {
      toast.error('Selecione uma data');
      return;
    }

    if (editingEvent) {
      updateCalendarEvent(editingEvent.id, {
        title: title.trim(),
        description: description.trim(),
        date: selectedDateStr,
        time: time || undefined,
        type: eventType,
      });
      toast.success('Evento atualizado');
    } else {
      addCalendarEvent({
        title: title.trim(),
        description: description.trim(),
        date: selectedDateStr,
        time: time || undefined,
        userId,
        createdBy: currentUser!.id,
        type: eventType,
        targetMode: 'specific',
        targetUsers: [userId],
      });
      toast.success('Evento criado');
    }
    resetForm();
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setTime(event.time || '');
    setEventType(event.type);
    setShowAddDialog(true);
  };

  const handleDelete = (eventId: string) => {
    deleteCalendarEvent(eventId);
    toast.success('Evento removido');
  };

  const resetForm = () => {
    setShowAddDialog(false);
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setTime('');
    setEventType('event');
  };

  const getCreatorName = (createdBy: string) => {
    return users.find((u) => u.id === createdBy)?.name || 'Desconhecido';
  };

  const getParticipantNames = (targetUsers: string[]) => {
    if (!targetUsers || targetUsers.length === 0) return '';
    return targetUsers
      .map((id) => users.find((u) => u.id === id)?.name || 'Desconhecido')
      .join(', ');
  };

  return (
    <div className="jf-surface p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          Calendário
        </h3>
      </div>

      <div
        className="mb-3 flex flex-wrap items-center gap-1 rounded-xl border bg-muted/30 p-1"
        role="group"
        aria-label="Visualização do calendário"
      >
        {(
          [
            ['month', 'Mês'],
            ['week', 'Semana'],
            ['day', 'Dia'],
            ['agenda', 'Agenda'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={viewMode === value ? 'default' : 'ghost'}
            className="h-8 flex-1 px-2 text-xs"
            onClick={() => setViewMode(value)}
            aria-pressed={viewMode === value}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid min-w-0 gap-4">
        {viewMode === 'month' && (
          <div className="flex min-w-0 justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="pointer-events-auto mx-auto max-w-full rounded-2xl border border-border/70 bg-muted/10 p-2 sm:p-3"
              modifiers={{
                reminder: reminderDates,
                eventAll: allDates,
                eventSector: sectorDates,
                eventSpecific: specificDates,
              }}
              modifiersClassNames={{
                reminder: 'bg-yellow-200 dark:bg-yellow-800/40 font-bold',
                eventAll: 'bg-red-200 dark:bg-red-800/40 font-bold',
                eventSector: 'bg-blue-200 dark:bg-blue-800/40 font-bold',
                eventSpecific: 'bg-green-200 dark:bg-green-800/40 font-bold',
              }}
            />
          </div>
        )}
        {viewMode === 'day' && selectedDate && (
          <div className="flex items-center justify-between gap-2 rounded-xl border p-2 text-xs">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            >
              Anterior
            </Button>
            <span className="font-medium">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              Próximo
            </Button>
          </div>
        )}
        {viewMode === 'week' && selectedDate && (
          <div className="grid min-w-0 grid-cols-7 gap-0.5">
            {Array.from({ length: 7 }, (_, index) =>
              addDays(startOfWeek(selectedDate, { weekStartsOn: 0 }), index)
            ).map((date) => (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0 py-2 text-center text-[10px] ${selectedDateStr === format(date, 'yyyy-MM-dd') ? 'border-primary bg-primary/10' : 'bg-card'}`}
              >
                <span className="block truncate text-[9px]">
                  {format(date, 'EEEEE', { locale: ptBR })}
                </span>
                <span className="text-xs font-semibold">{format(date, 'dd')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selectedDate
                ? viewMode === 'agenda'
                  ? 'Próximos eventos'
                  : viewMode === 'week'
                    ? 'Eventos da semana'
                    : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
              <AICalendarCreator />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowAddDialog(true);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Novo
              </Button>
            </div>
          </div>

          {eventsForDate.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum evento nesta data
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {eventsForDate.map((event) => {
                const colors = getEventColor(event);
                return (
                  <div
                    key={event.id}
                    className={cn(
                      'rounded-xl border p-3 text-sm text-gray-900 dark:text-gray-950',
                      colors.border,
                      colors.bg
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', colors.dot)} />
                          {event.type === 'reminder' ? (
                            <Bell className="w-3 h-3 text-gray-900 dark:text-gray-950" />
                          ) : (
                            <CalendarDays className="w-3 h-3 text-gray-900 dark:text-gray-950" />
                          )}
                          {(viewMode === 'week' || viewMode === 'agenda') && (
                            <span className="text-[10px] font-medium">{event.date}</span>
                          )}
                          <span className="font-semibold truncate text-gray-900 dark:text-gray-950">
                            {event.title}
                          </span>
                        </div>
                        {event.time && (
                          <p className="text-xs text-gray-800 dark:text-gray-900 flex items-center gap-1 mt-1 font-medium">
                            <Clock className="w-3 h-3" />
                            {event.time}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-xs text-gray-800 dark:text-gray-900 mt-1">
                            {event.description}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-700 dark:text-gray-800 mt-1">
                          Por: {getCreatorName(event.createdBy)}
                        </p>
                        {event.targetUsers && event.targetUsers.length > 1 && (
                          <p className="text-[10px] text-gray-700 dark:text-gray-800">
                            Participantes: {getParticipantNames(event.targetUsers)}
                          </p>
                        )}
                      </div>
                      {canEditEvent(event) && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-gray-900 dark:text-gray-950 hover:bg-black/10"
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-700 hover:bg-black/10 hover:text-red-800"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Anotações pessoais por data — armazenamento apenas no navegador. */}
      <section
        className="mt-4 space-y-2 rounded-xl border border-amber-300/60 bg-amber-50/40 p-3 dark:bg-amber-950/10"
        aria-label="Anotações do calendário"
      >
        <h4 className="flex items-center gap-2 text-xs font-semibold">
          <StickyNote className="h-4 w-4 text-amber-600" /> Post-its do dia
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione um dia'} · Anotações
          privadas neste navegador
        </p>
        <div className="flex min-w-0 gap-1">
          <Input
            className="min-w-0 flex-1 bg-background"
            value={noteText}
            maxLength={400}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addPostIt();
            }}
            placeholder="Escreva uma anotação"
            aria-label="Nova anotação"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={addPostIt}
            disabled={!noteText.trim() || !selectedDate}
            aria-label="Adicionar anotação"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {postIts
            .filter((note) => note.date === selectedDateStr)
            .map((note) => (
              <div
                key={note.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-100/70 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
              >
                <span className="min-w-0 whitespace-pre-wrap break-words">{note.text}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 hover:bg-amber-200/70 dark:hover:bg-amber-800/40"
                  onClick={() => saveNotes(postIts.filter((item) => item.id !== note.id))}
                  aria-label="Excluir anotação"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          {!postIts.some((note) => note.date === selectedDateStr) && (
            <p className="text-xs text-muted-foreground">Nenhuma anotação nesta data.</p>
          )}
        </div>
      </section>

      {/* Legenda de cores */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>Lembrete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span>Empresa (geral)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400" />
          <span>Setor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span>Individual</span>
        </div>
      </div>

      <Dialog
        open={showAddDialog}
        onOpenChange={(v) => {
          if (!v) resetForm();
          else setShowAddDialog(true);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
            />
            <div className="flex gap-3">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-32"
              />
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as 'event' | 'reminder')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Evento</SelectItem>
                  <SelectItem value="reminder">Lembrete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Data: {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Não selecionada'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editingEvent ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeCalendar;
