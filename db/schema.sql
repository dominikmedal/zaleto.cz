--
-- PostgreSQL database dump
--

\restrict DKe4J5CnrBSBIScOyBmFbHcGFiZ1rddjsm4Smihw1pPwH6Zre6bpGTcLylHRXuZ

-- Dumped from database version 18.6 (4e5fd08)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id integer NOT NULL,
    topic text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    category text,
    location text,
    excerpt text,
    content text,
    reading_time integer DEFAULT 5,
    published_at timestamp with time zone DEFAULT now(),
    generated_at timestamp with time zone DEFAULT now(),
    custom_image_url text
);


--
-- Name: articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;


--
-- Name: car_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.car_destinations (
    id integer NOT NULL,
    slug character varying(120) NOT NULL,
    name character varying(255) NOT NULL,
    country character varying(100) NOT NULL,
    country_slug character varying(100) NOT NULL,
    dc_path character varying(255) DEFAULT ''::character varying NOT NULL,
    dc_search_term character varying(255) DEFAULT ''::character varying NOT NULL,
    popular boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: car_destinations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.car_destinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: car_destinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.car_destinations_id_seq OWNED BY public.car_destinations.id;


--
-- Name: car_rental_ai; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.car_rental_ai (
    slug text NOT NULL,
    name text,
    country text,
    intro text,
    fuel_info text,
    driving_rules text,
    price_overview text,
    best_car_types text,
    trip_tips text,
    faq text,
    practical_tips text,
    car_examples text,
    generated_at timestamp with time zone DEFAULT now(),
    airport_info text,
    monthly_prices text
);


--
-- Name: destination_ai; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destination_ai (
    name text NOT NULL,
    description text,
    excursions text,
    generated_at timestamp with time zone DEFAULT now(),
    best_time text,
    places text,
    food text,
    trips text
);


--
-- Name: destination_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destination_photos (
    name text NOT NULL,
    photo_url text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hotel_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_checkpoints (
    agency text NOT NULL,
    key text NOT NULL,
    cycle_date text NOT NULL
);


--
-- Name: hotel_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotel_stats (
    hotel_id integer NOT NULL,
    min_price real,
    max_price real,
    available_dates integer DEFAULT 0,
    next_departure text,
    has_last_minute integer DEFAULT 0,
    has_first_minute integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    next_return_date text
);


--
-- Name: hotels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotels (
    id integer NOT NULL,
    slug text NOT NULL,
    agency text DEFAULT 'Fischer'::text NOT NULL,
    name text NOT NULL,
    country text,
    destination text,
    resort_town text,
    stars integer,
    description text,
    thumbnail_url text,
    amenities text,
    food_options text,
    price_includes text,
    latitude real,
    longitude real,
    photos text,
    review_score real,
    tags text,
    distances text,
    place_id text,
    reviews_fetched_at text,
    api_config text,
    canonical_slug text,
    is_last_minute integer DEFAULT 0,
    is_first_minute integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    static_fetched_at timestamp with time zone
);


--
-- Name: hotels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotels_id_seq OWNED BY public.hotels.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    hotel_id integer NOT NULL,
    source text DEFAULT 'google'::text NOT NULL,
    author_name text,
    author_photo text,
    rating integer,
    text text,
    review_date text,
    language text,
    cached_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: scraper_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_checkpoints (
    agency text NOT NULL,
    cycle_date text NOT NULL,
    completed_at text NOT NULL
);


--
-- Name: scraper_full_scrapes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraper_full_scrapes (
    agency text NOT NULL,
    completed_at text NOT NULL
);


--
-- Name: tours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tours (
    id integer NOT NULL,
    hotel_id integer NOT NULL,
    agency text DEFAULT 'Fischer'::text NOT NULL,
    departure_date text,
    return_date text,
    duration integer,
    price real NOT NULL,
    transport text,
    meal_plan text,
    adults integer DEFAULT 2,
    room_code text,
    price_single real,
    url_single text,
    url text NOT NULL,
    departure_city text,
    is_last_minute integer DEFAULT 0,
    is_first_minute integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
)
WITH (autovacuum_vacuum_scale_factor='0.01', autovacuum_analyze_scale_factor='0.005');


--
-- Name: tours_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tours_id_seq OWNED BY public.tours.id;


--
-- Name: weather_ai; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_ai (
    name text NOT NULL,
    description text,
    monthly_air text,
    monthly_sea text,
    monthly_rain_days text,
    monthly_sun_hours text,
    best_months text,
    winter text,
    spring text,
    summer text,
    autumn text,
    wind_info text,
    sea_info text,
    generated_at timestamp with time zone DEFAULT now()
);


--
-- Name: articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);


--
-- Name: car_destinations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_destinations ALTER COLUMN id SET DEFAULT nextval('public.car_destinations_id_seq'::regclass);


--
-- Name: hotels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotels ALTER COLUMN id SET DEFAULT nextval('public.hotels_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: tours id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tours ALTER COLUMN id SET DEFAULT nextval('public.tours_id_seq'::regclass);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_topic_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_topic_key UNIQUE (topic);


--
-- Name: car_destinations car_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_destinations
    ADD CONSTRAINT car_destinations_pkey PRIMARY KEY (id);


--
-- Name: car_destinations car_destinations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_destinations
    ADD CONSTRAINT car_destinations_slug_key UNIQUE (slug);


--
-- Name: car_rental_ai car_rental_ai_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rental_ai
    ADD CONSTRAINT car_rental_ai_pkey PRIMARY KEY (slug);


--
-- Name: destination_ai destination_ai_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_ai
    ADD CONSTRAINT destination_ai_pkey PRIMARY KEY (name);


--
-- Name: destination_photos destination_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destination_photos
    ADD CONSTRAINT destination_photos_pkey PRIMARY KEY (name);


--
-- Name: hotel_checkpoints hotel_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_checkpoints
    ADD CONSTRAINT hotel_checkpoints_pkey PRIMARY KEY (agency, key, cycle_date);


--
-- Name: hotel_stats hotel_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_stats
    ADD CONSTRAINT hotel_stats_pkey PRIMARY KEY (hotel_id);


--
-- Name: hotels hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);


--
-- Name: hotels hotels_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_slug_key UNIQUE (slug);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: scraper_checkpoints scraper_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_checkpoints
    ADD CONSTRAINT scraper_checkpoints_pkey PRIMARY KEY (agency, cycle_date);


--
-- Name: scraper_full_scrapes scraper_full_scrapes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraper_full_scrapes
    ADD CONSTRAINT scraper_full_scrapes_pkey PRIMARY KEY (agency);


--
-- Name: tours tours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tours
    ADD CONSTRAINT tours_pkey PRIMARY KEY (id);


--
-- Name: tours tours_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tours
    ADD CONSTRAINT tours_url_key UNIQUE (url);


--
-- Name: weather_ai weather_ai_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_ai
    ADD CONSTRAINT weather_ai_pkey PRIMARY KEY (name);


--
-- Name: idx_articles_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_articles_published ON public.articles USING btree (published_at DESC);


--
-- Name: idx_hotel_stats_next_dep; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_stats_next_dep ON public.hotel_stats USING btree (next_departure);


--
-- Name: idx_hotel_stats_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_stats_price ON public.hotel_stats USING btree (min_price);


--
-- Name: idx_hotels_canonical_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotels_canonical_slug ON public.hotels USING btree (canonical_slug);


--
-- Name: idx_hotels_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotels_country ON public.hotels USING btree (country);


--
-- Name: idx_hotels_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotels_destination ON public.hotels USING btree (destination);


--
-- Name: idx_hotels_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotels_slug ON public.hotels USING btree (slug);


--
-- Name: idx_hotels_stars; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotels_stars ON public.hotels USING btree (stars);


--
-- Name: idx_reviews_hotel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_hotel ON public.reviews USING btree (hotel_id);


--
-- Name: idx_tours_date_hotel_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_date_hotel_price ON public.tours USING btree (departure_date, hotel_id, price);


--
-- Name: idx_tours_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_dedup ON public.tours USING btree (hotel_id, agency, departure_date, duration, meal_plan, room_code, departure_city);


--
-- Name: idx_tours_dep_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_dep_price ON public.tours USING btree (departure_date, price);


--
-- Name: idx_tours_dep_ret_cov; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_dep_ret_cov ON public.tours USING btree (departure_date, return_date, hotel_id, price, is_last_minute, is_first_minute) WHERE (price > (0)::double precision);


--
-- Name: idx_tours_hotel_date_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_hotel_date_price ON public.tours USING btree (hotel_id, departure_date, price);


--
-- Name: idx_tours_slow_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tours_slow_path ON public.tours USING btree (departure_date, meal_plan, hotel_id, price) WHERE (price > (0)::double precision);


--
-- Name: hotel_stats hotel_stats_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotel_stats
    ADD CONSTRAINT hotel_stats_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;


--
-- Name: tours tours_hotel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tours
    ADD CONSTRAINT tours_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DKe4J5CnrBSBIScOyBmFbHcGFiZ1rddjsm4Smihw1pPwH6Zre6bpGTcLylHRXuZ

