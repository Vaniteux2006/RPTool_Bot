// AVISO
// ESTÁ EM PRODUÇÃO.
// ESTÁ SENDO FEITO POR IVANOL
// Mr: Deus por favor me ajude >:(

export interface AuditStats {
    bans: number
    warns: number
    roles: number
}

export interface EventStats {
    messages: number
    calls: number
    joins: number
}

export interface TopUser {
    name: string
    messages: number
    call: number
    avatar?: string
}

export interface ActivityStats {
    hours: string[]
    messages: number[]
    calls: number[]
}

export interface InactiveChannel {
    name: string
    time: string
}

export interface DashboardStats {
    audit: AuditStats
    events: EventStats
    topUsers: TopUser[]
    activity: ActivityStats
    inactiveChannels: InactiveChannel[]
}
