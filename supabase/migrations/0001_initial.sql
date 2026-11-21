-- StockSim initial schema. Run in Supabase SQL Editor or with Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  cash_balance numeric(18,2) not null default 100000.00 check (cash_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.stocks (
  symbol text primary key check (symbol ~ '^[A-Z0-9.]{1,12}$'),
  name text not null,
  price numeric(18,4) not null check (price > 0),
  change_percent numeric(9,4) not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.positions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity integer not null default 0 check (quantity >= 0),
  average_price numeric(18,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('buy','sell')),
  quantity integer not null check (quantity > 0),
  price numeric(18,4) not null check (price > 0),
  fee numeric(18,4) not null default 0,
  status text not null default 'filled' check (status in ('filled','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists positions_user_idx on public.positions(user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, cash_balance)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 100000.00)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Server-only function. API uses service role after validating the user's access token.
create or replace function public.place_market_order(p_user_id uuid, p_symbol text, p_side text, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_price numeric(18,4);
  v_cash numeric(18,2);
  v_position public.positions%rowtype;
  v_gross numeric(18,4);
  v_fee numeric(18,4);
  v_order_id uuid;
  v_new_qty integer;
  v_new_avg numeric(18,4);
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then raise exception 'Invalid quantity'; end if;
  if p_side not in ('buy','sell') then raise exception 'Invalid order side'; end if;
  select price into v_price from public.stocks where symbol = upper(p_symbol) and is_active = true for share;
  if v_price is null then raise exception 'Stock not found or inactive'; end if;
  select cash_balance into v_cash from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  v_gross := v_price * p_quantity;
  v_fee := round(v_gross * 0.001, 4);

  insert into public.positions(user_id, symbol, quantity, average_price)
  values (p_user_id, upper(p_symbol), 0, 0)
  on conflict (user_id, symbol) do nothing;
  select * into v_position from public.positions where user_id = p_user_id and symbol = upper(p_symbol) for update;

  if p_side = 'buy' then
    if v_cash < v_gross + v_fee then raise exception 'Insufficient virtual cash'; end if;
    update public.profiles set cash_balance = cash_balance - v_gross - v_fee where id = p_user_id;
    v_new_qty := v_position.quantity + p_quantity;
    v_new_avg := ((v_position.quantity * v_position.average_price) + v_gross) / v_new_qty;
  else
    if v_position.quantity < p_quantity then raise exception 'Insufficient shares'; end if;
    update public.profiles set cash_balance = cash_balance + v_gross - v_fee where id = p_user_id;
    v_new_qty := v_position.quantity - p_quantity;
    v_new_avg := case when v_new_qty = 0 then 0 else v_position.average_price end;
  end if;

  update public.positions set quantity = v_new_qty, average_price = v_new_avg, updated_at = now()
  where user_id = p_user_id and symbol = upper(p_symbol);
  insert into public.orders(user_id, symbol, side, quantity, price, fee)
  values (p_user_id, upper(p_symbol), p_side, p_quantity, v_price, v_fee) returning id into v_order_id;
  return jsonb_build_object('id',v_order_id,'symbol',upper(p_symbol),'side',p_side,'quantity',p_quantity,'price',v_price,'fee',v_fee,'status','filled');
end;
$$;

create or replace function public.get_portfolio(p_user_id uuid)
returns table(symbol text, name text, quantity integer, average_price numeric, current_price numeric, market_value numeric, unrealized_pnl numeric)
language sql security definer set search_path = public
as $$
  select p.symbol, s.name, p.quantity, p.average_price, s.price,
    p.quantity * s.price,
    p.quantity * (s.price - p.average_price)
  from public.positions p join public.stocks s on s.symbol = p.symbol
  where p.user_id = p_user_id and p.quantity > 0 order by p.symbol;
$$;

alter table public.profiles enable row level security;
alter table public.stocks enable row level security;
alter table public.positions enable row level security;
alter table public.orders enable row level security;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Public read active stocks" on public.stocks for select using (is_active = true);
create policy "Users read own positions" on public.positions for select using (auth.uid() = user_id);
create policy "Users read own orders" on public.orders for select using (auth.uid() = user_id);

revoke all on function public.place_market_order(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.get_portfolio(uuid) from public, anon, authenticated;
grant execute on function public.place_market_order(uuid,text,text,integer) to service_role;
grant execute on function public.get_portfolio(uuid) to service_role;

insert into public.stocks(symbol,name,price,change_percent) values
('AAPL','Apple Inc.',231.42,1.82),('MSFT','Microsoft',415.36,0.74),
('NVDA','NVIDIA Corporation',138.85,3.21),('AMZN','Amazon.com Inc.',218.94,-0.62),
('GOOGL','Alphabet Inc.',192.18,1.14),('TSLA','Tesla Inc.',338.11,-1.37)
on conflict (symbol) do nothing;
