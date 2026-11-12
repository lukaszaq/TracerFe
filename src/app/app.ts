import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Participant { name: string; displayName: string; color?: string }
interface Message { id: string; timestamp: string; type: string; from: string; to: string; label: string; status?: number }
interface Trace { trackingUuid: string; participants: Participant[]; messages: Message[] }
interface Detail extends Message {
  method?: string; uri?: string; topic?: string; messageKey?: string;
  headers?: { name: string; value: string }[]; payload?: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  template: `
  <header>
    <input [(ngModel)]="uuid" placeholder="trackingUUID" (keyup.enter)="load()" />
    <button (click)="load()">Szukaj</button>
    <span class="err">{{ error() }}</span>
  </header>
  <main>
    <div class="diagram">
      @if (trace()) {
      <svg [attr.width]="width()" [attr.height]="height()">
        <defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <path d="M0,0 L10,4 L0,8 z" fill="#333"/></marker></defs>
        @for (c of cols(); track c.name) {
          <line [attr.x1]="c.x" [attr.x2]="c.x" y1="60" [attr.y2]="height()" stroke="#bbb"/>
          <rect [attr.x]="c.x-80" y="10" width="160" height="40" rx="6" [attr.fill]="c.color || '#e8eefc'" stroke="#667"/>
          <text [attr.x]="c.x" y="35" text-anchor="middle">{{ c.displayName }}</text>
        }
        @for (r of rows(); track r.id) {
          <g class="msg" [class.sel]="selected()?.id === r.id" (click)="select(r.id)">
            <line [attr.x1]="r.x1" [attr.x2]="r.x2" [attr.y1]="r.y" [attr.y2]="r.y" stroke="#333" stroke-width="2"
                  [attr.stroke-dasharray]="r.type === 'REST_RESPONSE' ? '6 4' : null" marker-end="url(#a)"/>
            <line [attr.x1]="r.x1" [attr.x2]="r.x2" [attr.y1]="r.y" [attr.y2]="r.y" stroke="transparent" stroke-width="18"/>
            <text [attr.x]="(r.x1 + r.x2) / 2" [attr.y]="r.y - 7" text-anchor="middle">{{ r.label }}</text>
          </g>
        }
      </svg>
      }
    </div>
    @if (selected(); as d) {
      <aside>
        <h3>{{ d.type }}</h3>
        <p>{{ d.from }} → {{ d.to }}<br>{{ d.timestamp }}</p>
        @if (d.uri) { <p><b>{{ d.method }}</b> {{ d.uri }}</p> }
        @if (d.status) { <p>Status: <b>{{ d.status }}</b></p> }
        @if (d.topic) { <p>Topic: <b>{{ d.topic }}</b> &nbsp; Key: {{ d.messageKey }}</p> }
        <h4>Headers</h4>
        <table>@for (h of d.headers ?? []; track $index) { <tr><td>{{ h.name }}</td><td>{{ h.value }}</td></tr> }</table>
        <h4>{{ d.type.startsWith('KAFKA') ? 'Message' : 'Payload' }}</h4>
        <pre>{{ pretty(d.payload) }}</pre>
      </aside>
    }
  </main>`,
  styles: `
    :host { font-family: system-ui, sans-serif; display: block }
    header { padding: 10px; background: #f3f3f3; display: flex; gap: 8px }
    header input { width: 360px } .err { color: #b00 }
    main { display: flex; height: calc(100vh - 50px) }
    .diagram { flex: 1; overflow: auto } aside { width: 420px; overflow: auto; padding: 0 14px; border-left: 1px solid #ccc }
    .msg { cursor: pointer } .msg:hover line, .sel line { stroke: #0a58ca } text { font-size: 12px }
    pre { background: #f6f6f6; padding: 8px; white-space: pre-wrap; word-break: break-all }
    td { padding: 2px 8px 2px 0; font-size: 12px; vertical-align: top; word-break: break-all }`,
})
export class App {
  private http = inject(HttpClient);
  readonly colW = 200;
  readonly rowH = 52;
  uuid = '';
  trace = signal<Trace | null>(null);
  selected = signal<Detail | null>(null);
  error = signal('');

  cols = computed(() => (this.trace()?.participants ?? []).map((p, i) => ({ ...p, x: 100 + i * this.colW })));
  rows = computed(() => {
    const x = new Map(this.cols().map(c => [c.name, c.x]));
    return (this.trace()?.messages ?? []).map((m, i) =>
      ({ ...m, y: 100 + i * this.rowH, x1: x.get(m.from)!, x2: x.get(m.to)! }));
  });
  width = computed(() => this.cols().length * this.colW + 40);
  height = computed(() => 100 + (this.trace()?.messages.length ?? 0) * this.rowH + 30);

  load() {
    this.error.set(''); this.selected.set(null);
    this.http.get<Trace>(`/api/traces/${encodeURIComponent(this.uuid.trim())}`).subscribe({
      next: t => { this.trace.set(t); if (!t.messages.length) this.error.set('Brak zdarzeń'); },
      error: () => this.error.set('Błąd pobierania'),
    });
  }
  select(id: string) { this.http.get<Detail>(`/api/events/${id}`).subscribe(d => this.selected.set(d)); }
  pretty(p?: string) { try { return JSON.stringify(JSON.parse(p ?? ''), null, 2); } catch { return p ?? ''; } }
}
