import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

type View = 'Dashboard' | 'Leads' | 'Inventory' | 'Inbox' | 'Appointments' | 'Analytics' | 'Settings'
type LeadTemperature = 'Hot' | 'Warm' | 'Cold'
type IconName =
  | 'dashboard'
  | 'users'
  | 'car'
  | 'message'
  | 'calendar'
  | 'chart'
  | 'settings'
  | 'search'
  | 'bell'
  | 'plus'
  | 'arrow'
  | 'chevron'
  | 'more'
  | 'clock'
  | 'location'
  | 'sparkles'
  | 'filter'
  | 'download'
  | 'send'
  | 'phone'
  | 'mail'
  | 'menu'
  | 'close'
  | 'check'
  | 'external'
  | 'refresh'
  | 'shield'

type Lead = {
  id: string
  name: string
  initials: string
  color: string
  email: string
  phone: string
  vehicle: string
  budget: string
  source: string
  temperature: LeadTemperature
  score: number
  stage: string
  updated: string
}

type Vehicle = {
  id: string
  year: number
  make: string
  model: string
  trim: string
  price: string
  mileage: string
  fuel: string
  color: string
  stock: string
  status: 'Available' | 'Reserved' | 'Pending'
  imageClass: string
}

type Conversation = {
  id: string
  name: string
  initials: string
  color: string
  vehicle: string
  channel: 'Website' | 'WhatsApp'
  time: string
  preview: string
  unread: number
  human: boolean
  messages: { from: 'customer' | 'team'; text: string; time: string }[]
}

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  car: <><path d="m5 11 1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><path d="M3 11h18v7H3z" /><path d="M6 18v2m12-2v2M3 14h2m14 0h2" /><circle cx="7" cy="14.5" r=".7" /><circle cx="17" cy="14.5" r=".7" /></>,
  message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-.1-.1-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 15l.7 1.3L7 17l-1.3.7L5 19l-.7-1.3L3 17l1.3-.7L5 15Z" /></>,
  filter: <><path d="M4 7h16M7 12h10m-7 5h4" /><circle cx="8" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.7a2 2 0 0 1-.6 1.8L7.7 9.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.8-.6l2.7.5a2 2 0 0 1 1.7 2Z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

const navItems: { label: View; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Leads', icon: 'users' },
  { label: 'Inventory', icon: 'car' },
  { label: 'Inbox', icon: 'message' },
  { label: 'Appointments', icon: 'calendar' },
  { label: 'Analytics', icon: 'chart' },
]

const initialLeads: Lead[] = [
  { id: 'LD-2048', name: 'Olivia Bennett', initials: 'OB', color: 'rose', email: 'olivia.bennett@email.com', phone: '+1 (415) 555-0182', vehicle: '2024 Tesla Model Y', budget: '$45k – $55k', source: 'Website chat', temperature: 'Hot', score: 92, stage: 'Test drive', updated: '4 min ago' },
  { id: 'LD-2047', name: 'Noah Williams', initials: 'NW', color: 'blue', email: 'noah.williams@email.com', phone: '+1 (415) 555-0134', vehicle: '2023 BMW X5', budget: '$60k – $70k', source: 'WhatsApp', temperature: 'Hot', score: 87, stage: 'Qualified', updated: '18 min ago' },
  { id: 'LD-2046', name: 'Amelia Chen', initials: 'AC', color: 'violet', email: 'amelia.chen@email.com', phone: '+1 (415) 555-0191', vehicle: '2024 Audi Q5', budget: '$50k – $60k', source: 'Referral', temperature: 'Warm', score: 68, stage: 'Contacted', updated: '42 min ago' },
  { id: 'LD-2045', name: 'Ethan Brooks', initials: 'EB', color: 'amber', email: 'ethan.brooks@email.com', phone: '+1 (415) 555-0148', vehicle: '2022 Mercedes-Benz C-Class', budget: '$35k – $45k', source: 'Website', temperature: 'Warm', score: 61, stage: 'New lead', updated: '1 hr ago' },
  { id: 'LD-2044', name: 'Mia Patel', initials: 'MP', color: 'teal', email: 'mia.patel@email.com', phone: '+1 (415) 555-0173', vehicle: '2024 Toyota RAV4', budget: '$30k – $40k', source: 'Facebook', temperature: 'Cold', score: 34, stage: 'Follow-up', updated: '2 hrs ago' },
  { id: 'LD-2043', name: 'Liam Foster', initials: 'LF', color: 'slate', email: 'liam.foster@email.com', phone: '+1 (415) 555-0109', vehicle: '2023 Porsche Macan', budget: '$65k – $80k', source: 'Website chat', temperature: 'Warm', score: 73, stage: 'Contacted', updated: '3 hrs ago' },
]

const vehicles: Vehicle[] = [
  { id: 'V-1042', year: 2024, make: 'Tesla', model: 'Model Y', trim: 'Long Range AWD', price: '$48,990', mileage: '8,240 mi', fuel: 'Electric', color: 'Pearl white', stock: 'STK-1042', status: 'Available', imageClass: 'vehicle-electric' },
  { id: 'V-1038', year: 2023, make: 'BMW', model: 'X5', trim: 'xDrive40i', price: '$64,500', mileage: '16,380 mi', fuel: 'Gasoline', color: 'Mineral white', stock: 'STK-1038', status: 'Available', imageClass: 'vehicle-suv' },
  { id: 'V-1034', year: 2024, make: 'Audi', model: 'Q5', trim: 'Premium Plus', price: '$52,750', mileage: '5,120 mi', fuel: 'Hybrid', color: 'Glacier white', stock: 'STK-1034', status: 'Reserved', imageClass: 'vehicle-luxury' },
  { id: 'V-1029', year: 2022, make: 'Mercedes-Benz', model: 'C-Class', trim: 'C 300 Sedan', price: '$39,800', mileage: '22,060 mi', fuel: 'Gasoline', color: 'Obsidian black', stock: 'STK-1029', status: 'Available', imageClass: 'vehicle-sedan' },
  { id: 'V-1021', year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE Premium', price: '$35,990', mileage: '3,750 mi', fuel: 'Hybrid', color: 'Blueprint', stock: 'STK-1021', status: 'Pending', imageClass: 'vehicle-hybrid' },
  { id: 'V-1018', year: 2023, make: 'Porsche', model: 'Macan', trim: 'Macan S', price: '$72,400', mileage: '11,920 mi', fuel: 'Gasoline', color: 'Chalk', stock: 'STK-1018', status: 'Available', imageClass: 'vehicle-sport' },
]

const startingConversations: Conversation[] = [
  {
    id: 'C-101',
    name: 'Olivia Bennett',
    initials: 'OB',
    color: 'rose',
    vehicle: 'Tesla Model Y',
    channel: 'Website',
    time: '10:42 AM',
    preview: 'Could I come in this Saturday for a test drive?',
    unread: 2,
    human: false,
    messages: [
      { from: 'customer', text: 'Hi! I’m interested in the 2024 Tesla Model Y. Is it still available?', time: '10:34 AM' },
      { from: 'team', text: 'Hi Olivia! Yes, the Long Range AWD in Pearl White is currently available. It has 8,240 miles and is listed at $48,990.', time: '10:36 AM' },
      { from: 'customer', text: 'That sounds great. Could I come in this Saturday for a test drive?', time: '10:42 AM' },
    ],
  },
  {
    id: 'C-102',
    name: 'Noah Williams',
    initials: 'NW',
    color: 'blue',
    vehicle: 'BMW X5',
    channel: 'WhatsApp',
    time: '10:18 AM',
    preview: 'What would the monthly payment look like?',
    unread: 1,
    human: true,
    messages: [
      { from: 'customer', text: 'I’m looking at the BMW X5. Can you tell me a bit about the financing options?', time: '10:12 AM' },
      { from: 'team', text: 'Of course, Noah. I can help with that. Are you thinking of putting anything down?', time: '10:15 AM' },
      { from: 'customer', text: 'What would the monthly payment look like?', time: '10:18 AM' },
    ],
  },
  {
    id: 'C-103',
    name: 'Amelia Chen',
    initials: 'AC',
    color: 'violet',
    vehicle: 'Audi Q5',
    channel: 'Website',
    time: '9:56 AM',
    preview: 'I’d love to compare the Premium and Premium Plus.',
    unread: 0,
    human: false,
    messages: [
      { from: 'customer', text: 'I’d love to compare the Premium and Premium Plus trims.', time: '9:56 AM' },
    ],
  },
  {
    id: 'C-104',
    name: 'Ethan Brooks',
    initials: 'EB',
    color: 'amber',
    vehicle: 'Mercedes-Benz C-Class',
    channel: 'WhatsApp',
    time: '9:21 AM',
    preview: 'Thanks, I’ll check my schedule and get back to you.',
    unread: 0,
    human: false,
    messages: [
      { from: 'customer', text: 'Thanks, I’ll check my schedule and get back to you.', time: '9:21 AM' },
    ],
  },
]

const appointments = [
  { time: '10:30 AM', period: 'Today', name: 'Olivia Bennett', initials: 'OB', color: 'rose', type: 'Test drive', vehicle: 'Tesla Model Y', agent: 'Sarah Mitchell', status: 'Confirmed' },
  { time: '12:00 PM', period: 'Today', name: 'Daniel Rivera', initials: 'DR', color: 'green', type: 'Showroom visit', vehicle: 'BMW X5', agent: 'Marcus Lee', status: 'Confirmed' },
  { time: '2:15 PM', period: 'Today', name: 'Amelia Chen', initials: 'AC', color: 'violet', type: 'Consultation', vehicle: 'Audi Q5', agent: 'Sarah Mitchell', status: 'Pending' },
  { time: '9:00 AM', period: 'Tomorrow', name: 'Noah Williams', initials: 'NW', color: 'blue', type: 'Test drive', vehicle: 'BMW X5', agent: 'Jordan Blake', status: 'Confirmed' },
]

const chartData: Record<string, { labels: string[]; values: number[]; total: string; change: string }> = {
  'Last 7 days': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [38, 56, 45, 70, 58, 84, 74], total: '86', change: '+8.2%' },
  'Last 30 days': { labels: ['Oct 16', 'Oct 21', 'Oct 26', 'Oct 31', 'Nov 5', 'Nov 10', 'Nov 14'], values: [34, 52, 45, 68, 61, 82, 74], total: '248', change: '+12.8%' },
  'Last 90 days': { labels: ['Aug', 'Aug 15', 'Sep', 'Sep 15', 'Oct', 'Oct 15', 'Nov'], values: [30, 44, 58, 48, 70, 63, 84], total: '684', change: '+18.4%' },
}

const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

const schedule = [
  { time: '10:30 AM', name: 'Olivia Bennett', detail: 'Test drive · Tesla Model Y', color: 'rose', initials: 'OB', type: 'Drive' },
  { time: '12:00 PM', name: 'Daniel Rivera', detail: 'Showroom visit · BMW X5', color: 'green', initials: 'DR', type: 'Visit' },
  { time: '2:15 PM', name: 'Amelia Chen', detail: 'Consultation · Audi Q5', color: 'violet', initials: 'AC', type: 'Meet' },
]

function Avatar({ initials, color, size = 'normal' }: { initials: string; color: string; size?: 'normal' | 'small' | 'large' }) {
  return <span className={`avatar avatar-${color} avatar-${size}`}>{initials}</span>
}

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`badge badge-${tone.toLowerCase().replaceAll(' ', '-')}`}>{children}</span>
}

function App() {
  const [activeView, setActiveView] = useState<View>('Dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [range, setRange] = useState('Last 30 days')
  const [leads, setLeads] = useState(initialLeads)
  const [leadFilter, setLeadFilter] = useState<'All' | LeadTemperature>('All')
  const [conversations, setConversations] = useState(startingConversations)
  const [selectedConversation, setSelectedConversation] = useState(startingConversations[0].id)
  const [messageDraft, setMessageDraft] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const selectedChat = conversations.find((conversation) => conversation.id === selectedConversation) ?? conversations[0]
  const currentChart = chartData[range]

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }

      if (event.key === 'Escape') {
        setModalOpen(false)
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesQuery = !query || [lead.name, lead.id, lead.vehicle, lead.email, lead.source].some((value) => value.toLowerCase().includes(query))
      return matchesQuery && (leadFilter === 'All' || lead.temperature === leadFilter)
    })
  }, [leadFilter, leads, searchQuery])

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return vehicles.filter((vehicle) => [vehicle.make, vehicle.model, vehicle.trim, vehicle.stock].some((value) => value.toLowerCase().includes(query)))
  }, [searchQuery])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  function navigate(view: View) {
    setActiveView(view)
    setMobileMenuOpen(false)
  }

  function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const phone = String(formData.get('phone') ?? '').trim()
    const vehicle = String(formData.get('vehicle') ?? '').trim() || 'Vehicle not specified'
    const budget = String(formData.get('budget') ?? '').trim() || 'Not specified'
    if (!name || !email || !phone) return

    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
    const newLead: Lead = {
      id: `LD-${Date.now().toString().slice(-4)}`,
      name,
      initials,
      color: 'green',
      email,
      phone,
      vehicle,
      budget,
      source: 'Manual entry',
      temperature: 'Warm',
      score: 45,
      stage: 'New lead',
      updated: 'Just now',
    }

    setLeads((currentLeads) => [newLead, ...currentLeads])
    setModalOpen(false)
    setActiveView('Leads')
    showToast(`${name} was added to your leads.`)
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = messageDraft.trim()
    if (!message || !selectedChat) return
    const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date())
    setConversations((current) => current.map((conversation) => conversation.id === selectedChat.id
      ? { ...conversation, time, preview: message, messages: [...conversation.messages, { from: 'team', text: message, time }] }
      : conversation))
    setMessageDraft('')
  }

  function toggleHandover() {
    if (!selectedChat) return
    const nextHuman = !selectedChat.human
    setConversations((current) => current.map((conversation) => conversation.id === selectedChat.id ? { ...conversation, human: nextHuman } : conversation))
    showToast(nextHuman ? `You took over ${selectedChat.name}'s conversation.` : 'AI assistant resumed this conversation.')
  }

  function exportLeads() {
    const rows = [
      ['Lead ID', 'Name', 'Email', 'Phone', 'Vehicle interest', 'Budget', 'Source', 'Temperature', 'Score', 'Stage'],
      ...filteredLeads.map((lead) => [lead.id, lead.name, lead.email, lead.phone, lead.vehicle, lead.budget, lead.source, lead.temperature, String(lead.score), lead.stage]),
    ]
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'northstar-leads.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Your lead list has been exported.')
  }

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>N</span><i /></div>
          <div className="brand-copy"><strong>northstar</strong><span>DEALER CRM</span></div>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon">N</div>
          <div className="workspace-copy"><strong>Northstar Motors</strong><span>San Francisco, CA</span></div>
          <Icon name="chevron" size={15} />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          {navItems.slice(0, 1).map((item) => (
            <button key={item.label} className={`nav-item ${activeView === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
          <span className="nav-caption nav-caption-spaced">SALES &amp; CUSTOMERS</span>
          {navItems.slice(1, 5).map((item) => (
            <button key={item.label} className={`nav-item ${activeView === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)}>
              <Icon name={item.icon} /><span>{item.label}</span>
              {item.label === 'Inbox' && <span className="nav-count">3</span>}
            </button>
          ))}
          <span className="nav-caption nav-caption-spaced">INSIGHTS</span>
          {navItems.slice(5).map((item) => (
            <button key={item.label} className={`nav-item ${activeView === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
          <span className="nav-caption nav-caption-spaced">PREFERENCES</span>
          <button className={`nav-item ${activeView === 'Settings' ? 'active' : ''}`} onClick={() => navigate('Settings')}>
            <Icon name="settings" /><span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-status-card">
            <div className="ai-status-icon"><Icon name="sparkles" size={17} /></div>
            <div><strong>AI assistant</strong><span><i /> All systems operational</span></div>
            <button className="icon-button sidebar-more" aria-label="AI assistant options" onClick={() => showToast('Your AI assistant is online and ready.')}>
              <Icon name="more" size={17} />
            </button>
          </div>
          <button className="profile-button" onClick={() => navigate('Settings')}>
            <Avatar initials="SM" color="green" />
            <span className="profile-copy"><strong>Sarah Mitchell</strong><small>Dealer admin</small></span>
            <Icon name="more" size={17} />
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button icon-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <span className="topbar-date">{todayLabel}</span>
            <span className="topbar-separator">/</span>
            <span className="topbar-current">{activeView}</span>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Icon name="search" size={17} />
              <input ref={searchInputRef} aria-label="Search leads and vehicles" placeholder="Search anything..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              <kbd>Ctrl K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => showToast('You’re all caught up on notifications.')}>
              <Icon name="bell" size={19} /><i />
            </button>
            <div className="topbar-divider" />
            <button className="topbar-user" onClick={() => navigate('Settings')} aria-label="Open account settings">
              <Avatar initials="SM" color="green" />
              <span>Sarah M.</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {activeView === 'Dashboard' && (
            <Dashboard
              range={range}
              onRangeChange={setRange}
              chart={currentChart}
              leads={leads}
              onAddLead={() => setModalOpen(true)}
              onNavigate={navigate}
            />
          )}
          {activeView === 'Leads' && (
            <LeadsPage
              leads={filteredLeads}
              filter={leadFilter}
              onFilterChange={setLeadFilter}
              onAddLead={() => setModalOpen(true)}
              onExport={exportLeads}
            />
          )}
          {activeView === 'Inventory' && (
            <InventoryPage vehicles={filteredVehicles} onInfo={() => showToast('Inventory is read-only and synced from your dealership source.')} />
          )}
          {activeView === 'Inbox' && selectedChat && (
            <InboxPage
              conversations={conversations}
              selected={selectedChat}
              onSelect={(id) => {
                setSelectedConversation(id)
                setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, unread: 0 } : conversation))
              }}
              draft={messageDraft}
              onDraftChange={setMessageDraft}
              onSend={sendMessage}
              onHandover={toggleHandover}
            />
          )}
          {activeView === 'Appointments' && <AppointmentsPage onAction={() => showToast('Appointment scheduling will be available when the CRM backend is connected.')} />}
          {activeView === 'Analytics' && <AnalyticsPage leads={leads} />}
          {activeView === 'Settings' && <SettingsPage onInfo={() => showToast('This integration will be configured when the backend is connected.')} />}
        </div>
      </main>

      {toast && (
        <div className="toast" role="status">
          <span className="toast-check"><Icon name="check" size={15} /></span>
          <span>{toast}</span>
          <button className="icon-button toast-close" aria-label="Dismiss message" onClick={() => setToast('')}><Icon name="close" size={16} /></button>
        </div>
      )}

      {modalOpen && <LeadModal onClose={() => setModalOpen(false)} onSubmit={createLead} />}
    </div>
  )
}

function PageHeader({ copy, action, onAction }: { copy: { eyebrow: string; title: string; description: string }; action?: string; onAction?: () => void }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      {action && onAction && <button className="button button-primary" onClick={onAction}><Icon name="plus" size={17} />{action}</button>}
    </div>
  )
}

function Dashboard({
  range,
  onRangeChange,
  chart,
  leads,
  onAddLead,
  onNavigate,
}: {
  range: string
  onRangeChange: (range: string) => void
  chart: { labels: string[]; values: number[]; total: string; change: string }
  leads: Lead[]
  onAddLead: () => void
  onNavigate: (view: View) => void
}) {
  const hotLeads = leads.filter((lead) => lead.temperature === 'Hot').length
  const warmLeads = leads.filter((lead) => lead.temperature === 'Warm').length
  const coldLeads = leads.filter((lead) => lead.temperature === 'Cold').length
  const leadTotal = hotLeads + warmLeads + coldLeads || 1
  const hotShare = (hotLeads / leadTotal) * 100
  const warmShare = (warmLeads / leadTotal) * 100
  const latestLeads = leads.slice(0, 4)

  return (
    <>
      <div className="dashboard-heading">
        <PageHeader
          copy={{ eyebrow: 'DEALERSHIP OVERVIEW', title: 'Good morning, Sarah', description: 'Here’s what’s happening at your dealership today.' }}
          action="Add a lead"
          onAction={onAddLead}
        />
        <label className="select-wrap range-select">
          <Icon name="calendar" size={16} />
          <select aria-label="Dashboard date range" value={range} onChange={(event) => onRangeChange(event.target.value)}>
            {Object.keys(chartData).map((value) => <option key={value}>{value}</option>)}
          </select>
          <Icon name="chevron" size={15} />
        </label>
      </div>

      <section className="metric-grid" aria-label="Sales overview">
        <MetricCard label="Total leads" value="248" change="+12.8%" detail="vs. previous period" icon="users" tone="green" />
        <MetricCard label="Qualified leads" value="86" change="+8.2%" detail="vs. previous period" icon="sparkles" tone="lavender" />
        <MetricCard label="Appointments" value="32" change="+16.4%" detail="vs. previous period" icon="calendar" tone="blue" />
        <MetricCard label="Conversion rate" value="18.6%" change="+2.4%" detail="vs. previous period" icon="chart" tone="gold" />
      </section>

      <section className="dashboard-chart-grid">
        <div className="card leads-chart-card">
          <div className="card-heading">
            <div><h2>Lead activity</h2><p>New leads coming into your dealership</p></div>
            <button className="icon-button subtle-button" aria-label="More lead activity options"><Icon name="more" /></button>
          </div>
          <div className="chart-summary"><strong>{chart.total}</strong><span className="trend-positive"><span>↗</span> {chart.change}</span><small>leads in period</small></div>
          <div className="line-chart">
            <div className="chart-y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
            <div className="chart-plot">
              <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
              <svg viewBox="0 0 640 188" preserveAspectRatio="none" role="img" aria-label={`Lead activity trend for ${range}`}>
                <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4a8f74" stopOpacity=".2" /><stop offset="100%" stopColor="#4a8f74" stopOpacity="0" /></linearGradient></defs>
                <path d="M0 150 C35 142 47 101 92 116 S147 143 185 102 S242 78 277 96 S331 121 370 76 S428 55 462 74 S517 106 554 57 S607 48 640 33 L640 188 L0 188Z" fill="url(#chart-fill)" />
                <path d="M0 150 C35 142 47 101 92 116 S147 143 185 102 S242 78 277 96 S331 121 370 76 S428 55 462 74 S517 106 554 57 S607 48 640 33" fill="none" stroke="#4a8f74" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <circle cx="640" cy="33" r="5" fill="#fff" stroke="#4a8f74" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="chart-x-labels">{chart.labels.map((label) => <span key={label}>{label}</span>)}</div>
            </div>
          </div>
        </div>

        <div className="card temperature-card">
          <div className="card-heading"><div><h2>Lead temperature</h2><p>Know where to focus today</p></div><button className="icon-button subtle-button" aria-label="More lead temperature options"><Icon name="more" /></button></div>
          <div className="temperature-content">
            <div className="donut-wrap">
              <div className="donut-chart" style={{ background: `conic-gradient(#d67a62 0 ${hotShare}%, #e8ba70 ${hotShare}% ${hotShare + warmShare}%, #91b9a2 ${hotShare + warmShare}% 100%)` }}>
                <div><strong>{leadTotal}</strong><span>active leads</span></div>
              </div>
            </div>
            <div className="temperature-legend">
              <div><i className="legend-dot hot-dot" /><span>Hot leads</span><strong>{hotLeads}</strong></div>
              <div><i className="legend-dot warm-dot" /><span>Warm leads</span><strong>{warmLeads}</strong></div>
              <div><i className="legend-dot cold-dot" /><span>Cold leads</span><strong>{coldLeads}</strong></div>
              <button className="text-link" onClick={() => onNavigate('Leads')}>View all leads <Icon name="arrow" size={15} /></button>
            </div>
          </div>
          <div className="priority-note"><span className="priority-sparkle"><Icon name="sparkles" size={15} /></span><span><strong>{hotLeads} buyers are ready.</strong> Follow up while interest is high.</span></div>
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="card recent-leads-card">
          <div className="card-heading recent-card-heading">
            <div><h2>Recent leads</h2><p>Your latest customer inquiries</p></div>
            <button className="text-link" onClick={() => onNavigate('Leads')}>View all <Icon name="arrow" size={15} /></button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>LEAD</th><th>INTERESTED IN</th><th>SOURCE</th><th>PRIORITY</th><th /></tr></thead>
              <tbody>
                {latestLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td><div className="lead-person"><Avatar initials={lead.initials} color={lead.color} /><span><strong>{lead.name}</strong><small>{lead.id}</small></span></div></td>
                    <td><span className="vehicle-interest">{lead.vehicle}</span></td>
                    <td><span className="source-label">{lead.source}</span></td>
                    <td><Badge tone={lead.temperature}>{lead.temperature}</Badge></td>
                    <td><button className="icon-button row-more" aria-label={`More options for ${lead.name}`}><Icon name="more" size={17} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card schedule-card">
          <div className="card-heading"><div><h2>Today’s schedule</h2><p>3 appointments on your calendar</p></div><button className="icon-button subtle-button" aria-label="More appointment options"><Icon name="more" /></button></div>
          <div className="schedule-list">
            {schedule.map((item) => (
              <div className="schedule-item" key={item.name}>
                <div className="schedule-time">{item.time}<span>{item.type}</span></div>
                <span className="schedule-timeline"><i /></span>
                <Avatar initials={item.initials} color={item.color} size="small" />
                <div className="schedule-person"><strong>{item.name}</strong><span>{item.detail}</span></div>
              </div>
            ))}
          </div>
          <button className="schedule-footer" onClick={() => onNavigate('Appointments')}>Open calendar <Icon name="arrow" size={15} /></button>
        </div>
      </section>

      <section className="card pipeline-strip">
        <div className="pipeline-title"><span className="pipeline-icon"><Icon name="chart" size={17} /></span><span><strong>Sales pipeline</strong><small>Opportunities by stage</small></span></div>
        <div className="pipeline-stages">
          {([['New leads', 64, 'pipeline-green'], ['Contacted', 42, 'pipeline-blue'], ['Qualified', 28, 'pipeline-lavender'], ['Test drives', 16, 'pipeline-gold'], ['Won', 9, 'pipeline-dark']] as const).map(([label, count, color]) => (
            <div className="pipeline-stage" key={label}><div><span>{label}</span><strong>{count}</strong></div><div className="pipeline-track"><i className={color} style={{ width: `${Number(count) * 1.4}%` }} /></div></div>
          ))}
        </div>
        <button className="icon-button pipeline-more" aria-label="View sales pipeline" onClick={() => onNavigate('Analytics')}><Icon name="arrow" size={17} /></button>
      </section>
    </>
  )
}

function MetricCard({ label, value, change, detail, icon, tone }: { label: string; value: string; change: string; detail: string; icon: IconName; tone: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon name={icon} size={18} /></span></div>
      <div className="metric-main"><strong>{value}</strong><span className="metric-change">{change}</span></div>
      <div className="metric-foot"><span>{detail}</span><span className="metric-sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span></div>
    </div>
  )
}

function LeadsPage({ leads, filter, onFilterChange, onAddLead, onExport }: {
  leads: Lead[]
  filter: 'All' | LeadTemperature
  onFilterChange: (filter: 'All' | LeadTemperature) => void
  onAddLead: () => void
  onExport: () => void
}) {
  const filters: ('All' | LeadTemperature)[] = ['All', 'Hot', 'Warm', 'Cold']
  return (
    <>
      <PageHeader copy={{ eyebrow: 'CUSTOMER RELATIONSHIPS', title: 'Leads', description: 'Keep every opportunity moving toward a sale.' }} action="Add a lead" onAction={onAddLead} />
      <div className="card leads-page-card">
        <div className="leads-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Filter leads by temperature">
            {filters.map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'selected' : ''} onClick={() => onFilterChange(value)}>{value}{value === 'All' && <span>{leads.length}</span>}</button>)}
          </div>
          <div className="toolbar-actions">
            <button className="button button-secondary" onClick={onExport}><Icon name="download" size={16} />Export</button>
            <button className="button button-secondary" onClick={() => onFilterChange('All')}><Icon name="filter" size={16} />Filters</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table leads-table">
            <thead><tr><th>CUSTOMER</th><th>VEHICLE INTEREST</th><th>BUDGET</th><th>SOURCE</th><th>LEAD SCORE</th><th>STAGE</th><th>LAST ACTIVITY</th><th /></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td><div className="lead-person"><Avatar initials={lead.initials} color={lead.color} /><span><strong>{lead.name}</strong><small>{lead.email}</small></span></div></td>
                  <td>{lead.vehicle}</td><td>{lead.budget}</td><td><span className="source-label">{lead.source}</span></td>
                  <td><div className="score-cell"><span className="score-track"><i style={{ width: `${lead.score}%` }} /></span><strong>{lead.score}</strong></div></td>
                  <td><Badge tone={lead.temperature}>{lead.temperature}</Badge></td><td className="muted-cell">{lead.updated}</td>
                  <td><button className="icon-button row-more" aria-label={`More options for ${lead.name}`}><Icon name="more" size={17} /></button></td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td className="empty-table" colSpan={8}>No leads match this search. Try another name, email or vehicle.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{leads.length}</strong> leads</span><div className="pagination"><button disabled aria-label="Previous page"><Icon name="chevron" size={15} /></button><button className="page-number">1</button><button disabled aria-label="Next page"><Icon name="chevron" size={15} /></button></div></div>
      </div>
    </>
  )
}

function InventoryPage({ vehicles: visibleVehicles, onInfo }: { vehicles: Vehicle[]; onInfo: () => void }) {
  return (
    <>
      <PageHeader copy={{ eyebrow: 'DEALERSHIP INVENTORY', title: 'Vehicle inventory', description: 'Browse vehicles synced from your dealership source.' }} action="Source settings" onAction={onInfo} />
      <div className="inventory-source-banner">
        <span className="source-sync-icon"><Icon name="refresh" size={18} /></span>
        <span><strong>Inventory synced from Northstar Motors</strong><small>Last synced 12 minutes ago · Read-only connection</small></span>
        <Badge tone="available">Connected</Badge>
        <button className="icon-button" aria-label="Inventory source details" onClick={onInfo}><Icon name="external" size={17} /></button>
      </div>
      <div className="inventory-summary"><span><strong>{visibleVehicles.length}</strong> vehicles shown</span><button className="button button-secondary" onClick={onInfo}><Icon name="filter" size={16} />Inventory filters</button></div>
      <div className="vehicle-grid">
        {visibleVehicles.map((vehicle) => (
          <article className="vehicle-card" key={vehicle.id}>
            <div className={`vehicle-visual ${vehicle.imageClass}`}>
              <span className="vehicle-year">{vehicle.year}</span>
              <span className={`vehicle-status vehicle-status-${vehicle.status.toLowerCase()}`}><i />{vehicle.status}</span>
              <div className="vehicle-silhouette" aria-hidden="true"><span /><i /><b /></div>
              <span className="vehicle-stock">{vehicle.stock}</span>
            </div>
            <div className="vehicle-card-body">
              <div className="vehicle-title-row"><div><h2>{vehicle.make} {vehicle.model}</h2><p>{vehicle.trim}</p></div><button className="icon-button" aria-label={`More options for ${vehicle.make} ${vehicle.model}`}><Icon name="more" size={17} /></button></div>
              <div className="vehicle-price">{vehicle.price}<span> · {vehicle.mileage}</span></div>
              <div className="vehicle-specs"><span>{vehicle.fuel}</span><span>{vehicle.color}</span></div>
              <div className="vehicle-card-footer"><span><i className="inventory-dot" />Synced from source</span><button className="text-link" onClick={onInfo}>View details <Icon name="arrow" size={14} /></button></div>
            </div>
          </article>
        ))}
        {visibleVehicles.length === 0 && <div className="empty-state"><span className="empty-state-icon"><Icon name="car" size={22} /></span><h2>No vehicles found</h2><p>Try searching by make, model or stock number.</p></div>}
      </div>
      <p className="inventory-footnote"><Icon name="shield" size={15} />Vehicle records are displayed from your dealership’s inventory source and cannot be edited here.</p>
    </>
  )
}

function InboxPage({ conversations: allConversations, selected, onSelect, draft, onDraftChange, onSend, onHandover }: {
  conversations: Conversation[]
  selected: Conversation
  onSelect: (id: string) => void
  draft: string
  onDraftChange: (draft: string) => void
  onSend: (event: FormEvent<HTMLFormElement>) => void
  onHandover: () => void
}) {
  return (
    <>
      <PageHeader copy={{ eyebrow: 'CUSTOMER CONVERSATIONS', title: 'Inbox', description: 'Every customer conversation, all in one place.' }} />
      <div className="inbox-layout card">
        <aside className="conversation-list">
          <div className="conversation-list-header"><div><h2>Conversations</h2><p>4 active chats</p></div><button className="icon-button" aria-label="Conversation filters"><Icon name="filter" size={17} /></button></div>
          <div className="inbox-search"><Icon name="search" size={16} /><input placeholder="Search conversations" aria-label="Search conversations" /></div>
          <div className="conversation-filters"><button className="active">All <span>4</span></button><button>AI active</button><button>Assigned</button></div>
          <div className="conversation-items">
            {allConversations.map((conversation) => (
              <button key={conversation.id} className={`conversation-item ${selected.id === conversation.id ? 'selected' : ''}`} onClick={() => onSelect(conversation.id)}>
                <span className="conversation-avatar"><Avatar initials={conversation.initials} color={conversation.color} /><i className={`channel-mark ${conversation.channel === 'WhatsApp' ? 'channel-whatsapp' : ''}`}>{conversation.channel === 'WhatsApp' ? 'w' : '✦'}</i></span>
                <span className="conversation-info"><span className="conversation-topline"><strong>{conversation.name}</strong><time>{conversation.time}</time></span><span className="conversation-vehicle">{conversation.vehicle}</span><span className="conversation-preview">{conversation.preview}</span></span>
                {conversation.unread > 0 && <span className="unread-count">{conversation.unread}</span>}
              </button>
            ))}
          </div>
        </aside>
        <section className="conversation-thread">
          <header className="thread-header">
            <div className="thread-customer"><Avatar initials={selected.initials} color={selected.color} /><span><strong>{selected.name}</strong><small>Interested in {selected.vehicle}</small></span></div>
            <div className="thread-actions"><span className="ai-active-label"><i />{selected.human ? 'Agent assigned' : 'AI assistant active'}</span><button className="button button-secondary handover-button" onClick={onHandover}>{selected.human ? 'Return to AI' : 'Take over'}</button><button className="icon-button" aria-label="More conversation options"><Icon name="more" /></button></div>
          </header>
          <div className="thread-context"><span className="context-icon"><Icon name={selected.channel === 'WhatsApp' ? 'phone' : 'message'} size={15} /></span><span>{selected.channel} conversation</span><span className="context-divider" /><span>Lead created today</span><button className="text-link">View lead <Icon name="arrow" size={14} /></button></div>
          <div className="message-list">
            <div className="day-divider"><span>Today, November 14</span></div>
            {selected.messages.map((message, index) => (
              <div className={`message-row ${message.from === 'team' ? 'message-outgoing' : ''}`} key={`${selected.id}-${index}`}>
                {message.from === 'customer' && <Avatar initials={selected.initials} color={selected.color} size="small" />}
                <div className="message-body"><div className={`message-bubble ${message.from === 'team' ? 'bubble-outgoing' : ''}`}>{message.text}</div><span className="message-time">{message.time}{message.from === 'team' && <Icon name="check" size={12} />}</span></div>
              </div>
            ))}
            {!selected.human && <div className="ai-draft-note"><span><Icon name="sparkles" size={14} /></span>AI assistant is ready to help reply. You can take over at any time.</div>}
          </div>
          <form className="message-composer" onSubmit={onSend}>
            <textarea aria-label="Write a reply" placeholder="Write a message..." value={draft} onChange={(event) => onDraftChange(event.target.value)} rows={2} />
            <div className="composer-footer"><span>Replying as <strong>Northstar Motors</strong></span><button className="send-button" type="submit" disabled={!draft.trim()}>Send <Icon name="send" size={15} /></button></div>
          </form>
        </section>
      </div>
    </>
  )
}

function AppointmentsPage({ onAction }: { onAction: () => void }) {
  const [filter, setFilter] = useState<'All' | 'Today' | 'Tomorrow'>('All')
  const visibleAppointments = appointments.filter((appointment) => filter === 'All' || appointment.period === filter)
  return (
    <>
      <PageHeader copy={{ eyebrow: 'SALES CALENDAR', title: 'Appointments', description: 'Make every showroom visit count.' }} action="Schedule appointment" onAction={onAction} />
      <div className="appointment-overview">
        <div className="appointment-overview-card"><span className="metric-icon metric-green"><Icon name="calendar" /></span><span><strong>12</strong><small>This week</small></span><em>+3 from last week</em></div>
        <div className="appointment-overview-card"><span className="metric-icon metric-blue"><Icon name="car" /></span><span><strong>8</strong><small>Test drives</small></span><em>Across 3 sales agents</em></div>
        <div className="appointment-overview-card"><span className="metric-icon metric-gold"><Icon name="check" /></span><span><strong>92%</strong><small>Show-up rate</small></span><em>+4.6% this month</em></div>
      </div>
      <div className="card appointments-card">
        <div className="appointments-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filter appointments">{(['All', 'Today', 'Tomorrow'] as const).map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><button className="button button-secondary" onClick={onAction}><Icon name="calendar" size={16} />Calendar view</button></div>
        <div className="table-scroll"><table className="data-table appointments-table"><thead><tr><th>TIME</th><th>CUSTOMER</th><th>APPOINTMENT</th><th>SALES AGENT</th><th>STATUS</th><th /></tr></thead><tbody>
          {visibleAppointments.map((appointment) => <tr key={`${appointment.name}-${appointment.time}`}><td><strong className="appointment-time">{appointment.time}</strong><small className="appointment-period">{appointment.period}</small></td><td><div className="lead-person"><Avatar initials={appointment.initials} color={appointment.color} /><strong>{appointment.name}</strong></div></td><td><strong>{appointment.type}</strong><small className="appointment-period">{appointment.vehicle}</small></td><td>{appointment.agent}</td><td><Badge tone={appointment.status === 'Confirmed' ? 'available' : 'warm'}>{appointment.status}</Badge></td><td><button className="icon-button row-more" aria-label={`More options for ${appointment.name}'s appointment`}><Icon name="more" size={17} /></button></td></tr>)}
          {visibleAppointments.length === 0 && <tr><td className="empty-table" colSpan={6}>No appointments for this day.</td></tr>}
        </tbody></table></div>
      </div>
    </>
  )
}

function AnalyticsPage({ leads }: { leads: Lead[] }) {
  const temperatures = ['Hot', 'Warm', 'Cold'] as const
  return (
    <>
      <PageHeader copy={{ eyebrow: 'PERFORMANCE', title: 'Analytics', description: 'Understand what’s driving your sales forward.' }} />
      <div className="analytics-summary">
        <div className="analytics-card card"><div className="card-heading"><div><h2>Lead conversion</h2><p>By pipeline stage this month</p></div><Badge tone="available">+2.4%</Badge></div><div className="conversion-chart">
          {[['New leads', 100, '248'], ['Contacted', 72, '179'], ['Qualified', 48, '86'], ['Test drives', 31, '42'], ['Won', 18, '23']].map(([label, width, value]) => <div className="conversion-row" key={label}><span>{label}</span><i><b style={{ width: `${width}%` }} /></i><strong>{value}</strong></div>)}
          <div className="conversion-foot"><span>Lead to sale conversion</span><strong>18.6%</strong></div>
        </div></div>
        <div className="analytics-card card"><div className="card-heading"><div><h2>Lead quality</h2><p>Current active pipeline</p></div><button className="icon-button"><Icon name="more" /></button></div><div className="quality-chart">
          {temperatures.map((temperature) => { const count = leads.filter((lead) => lead.temperature === temperature).length; return <div className="quality-row" key={temperature}><span className={`quality-dot quality-${temperature.toLowerCase()}`} /><span>{temperature} intent</span><strong>{count}</strong><i><b className={`quality-bar-${temperature.toLowerCase()}`} style={{ width: `${Math.max((count / Math.max(leads.length, 1)) * 100, 8)}%` }} /></i></div> })}
          <div className="quality-insight"><Icon name="sparkles" size={16} /><span><strong>Follow up with hot leads first.</strong><br />They are most likely to convert this week.</span></div>
        </div></div>
      </div>
      <div className="card channel-card"><div className="card-heading"><div><h2>Lead sources</h2><p>Where your customers are finding you</p></div><button className="text-link">This month <Icon name="chevron" size={14} /></button></div><div className="channel-grid">
        {[['Website chat', '98', '39%', 'channel-green'], ['WhatsApp', '72', '29%', 'channel-gold'], ['Referral', '46', '19%', 'channel-lavender'], ['Social media', '32', '13%', 'channel-blue']].map(([label, count, percent, color]) => <div className="channel-stat" key={label}><span className={`channel-stat-icon ${color}`}><Icon name={label === 'Website chat' ? 'message' : label === 'Referral' ? 'users' : label === 'Social media' ? 'external' : 'phone'} size={18} /></span><span><small>{label}</small><strong>{count}</strong></span><em>{percent}</em></div>)}
      </div></div>
    </>
  )
}

function SettingsPage({ onInfo }: { onInfo: () => void }) {
  return (
    <>
      <PageHeader copy={{ eyebrow: 'WORKSPACE', title: 'Settings', description: 'Manage your dealership workspace and connected services.' }} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections"><button className="selected"><Icon name="dashboard" size={16} />General</button><button onClick={onInfo}><Icon name="users" size={16} />Team &amp; roles</button><button onClick={onInfo}><Icon name="message" size={16} />Integrations</button><button onClick={onInfo}><Icon name="shield" size={16} />Security</button><button onClick={onInfo}><Icon name="chart" size={16} />Subscription &amp; usage</button></nav>
        <div className="settings-content">
          <section className="card settings-section"><div className="settings-section-heading"><div><h2>Dealership profile</h2><p>Basic information about your workspace.</p></div><button className="button button-secondary" onClick={onInfo}>Edit profile</button></div><div className="dealership-profile"><div className="dealership-avatar">N</div><div><strong>Northstar Motors</strong><span>San Francisco, California</span><small>Dealership administrator · Workspace ID NSM-001</small></div></div><div className="settings-field-grid"><div><span>Business email</span><strong>hello@northstarmotors.com</strong></div><div><span>Phone number</span><strong>+1 (415) 555-0100</strong></div><div><span>Time zone</span><strong>Pacific Time (UTC−08:00)</strong></div><div><span>Default currency</span><strong>USD — US Dollar</strong></div></div></section>
          <section className="card settings-section"><div className="settings-section-heading"><div><h2>Connected services</h2><p>Services supporting your dealership workflow.</p></div><button className="text-link" onClick={onInfo}>Manage connections <Icon name="arrow" size={14} /></button></div><div className="connection-row"><span className="connection-icon connection-ai"><Icon name="sparkles" size={18} /></span><span><strong>AI sales assistant</strong><small>Customer chat and lead qualification</small></span><Badge tone="available">Active</Badge></div><div className="connection-row"><span className="connection-icon connection-inventory"><Icon name="car" size={18} /></span><span><strong>Vehicle inventory source</strong><small>Read-only · Last synced 12 minutes ago</small></span><Badge tone="available">Connected</Badge></div><div className="connection-row"><span className="connection-icon connection-whatsapp"><Icon name="phone" size={18} /></span><span><strong>WhatsApp Business</strong><small>Connect a business account to enable messaging</small></span><button className="button button-secondary small-button" onClick={onInfo}>Connect</button></div></section>
          <section className="privacy-note"><Icon name="shield" size={17} /><span><strong>Your dealership data stays yours.</strong> Customer and sales information is isolated to your workspace.</span></section>
        </div>
      </div>
    </>
  )
}

function LeadModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><span className="eyebrow">CUSTOMER RELATIONSHIPS</span><h2 id="modal-title">Add a new lead</h2><p>Save a customer inquiry to your sales pipeline.</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <form onSubmit={onSubmit}>
          <label>Customer name<input name="name" autoFocus placeholder="e.g. Jamie Parker" required /></label>
          <div className="modal-form-row"><label>Email address<input name="email" type="email" placeholder="jamie@email.com" required /></label><label>Phone number<input name="phone" type="tel" placeholder="+1 (555) 000-0000" required /></label></div>
          <label>Vehicle of interest<input name="vehicle" placeholder="e.g. 2024 Tesla Model Y" /></label>
          <label>Budget range<input name="budget" placeholder="e.g. $40,000 – $50,000" /></label>
          <div className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Icon name="plus" size={16} />Add lead</button></div>
        </form>
      </section>
    </div>
  )
}

export default App
