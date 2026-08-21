--
-- PostgreSQL database dump
--

\restrict M7yIufmbz69a8Qbg22utzaiibj3mRaELjiwJjqvgO1zci2wgYcm31wj289cIc85

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

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

--
-- Name: rhia_resolve_location(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rhia_resolve_location(p_city text, p_country text DEFAULT NULL::text, p_limit integer DEFAULT 10) RETURNS TABLE(city_id bigint, geoname_id bigint, city_name text, ascii_name text, admin1_name text, admin2_name text, market_iso2 character, country_name text, latitude double precision, longitude double precision, timezone text, population bigint, is_capital boolean, priority_tier integer, priority_weight integer, city_match_type text, country_match_type text, location_score integer)
    LANGUAGE sql STABLE
    AS $$

WITH params AS (
    SELECT
        LOWER(TRIM(COALESCE(p_city, ''))) AS city_query,
        LOWER(TRIM(COALESCE(p_country, ''))) AS country_query
),

valid_markets AS (
    SELECT
        cc.*,

        CASE
            WHEN p.country_query = ''
                THEN 'COUNTRY_NOT_PROVIDED'

            WHEN LOWER(TRIM(cc.iso2::TEXT)) = p.country_query
                THEN 'EXACT_ISO2'

            WHEN LOWER(TRIM(cc.country_name)) = p.country_query
                THEN 'EXACT_COUNTRY_NAME'

            WHEN EXISTS (
                SELECT 1
                FROM unnest(cc.aliases) AS alias_value
                WHERE LOWER(TRIM(alias_value)) = p.country_query
            )
                THEN 'EXACT_COUNTRY_ALIAS'

            ELSE 'COUNTRY_MISMATCH'
        END AS country_match_type

    FROM country_context cc
    CROSS JOIN params p

    WHERE
        cc.is_active = TRUE
        AND cc.prospecting_enabled = TRUE

        AND (
            p.country_query = ''

            OR LOWER(TRIM(cc.iso2::TEXT)) = p.country_query

            OR LOWER(TRIM(cc.country_name)) = p.country_query

            OR EXISTS (
                SELECT 1
                FROM unnest(cc.aliases) AS alias_value
                WHERE LOWER(TRIM(alias_value)) = p.country_query
            )
        )
),

candidates AS (
    SELECT
        c.city_id,
        c.geoname_id,
        c.city_name,
        c.ascii_name,
        c.admin1_name,
        c.admin2_name,
        c.market_iso2,

        vm.country_name,

        c.latitude,
        c.longitude,
        c.timezone,
        c.population,
        c.is_capital,

        vm.priority_tier,
        vm.priority_weight,

        CASE
            WHEN LOWER(TRIM(c.city_name)) = p.city_query
                THEN 'EXACT_CITY_NAME'

            WHEN LOWER(TRIM(c.ascii_name)) = p.city_query
                THEN 'EXACT_ASCII_NAME'

            WHEN EXISTS (
                SELECT 1
                FROM unnest(c.aliases) AS alias_value
                WHERE LOWER(TRIM(alias_value)) = p.city_query
            )
                THEN 'EXACT_ALIAS'

            WHEN POSITION(
                ' ' || p.city_query || ' '
                IN
                ' ' ||
                LOWER(
                    REGEXP_REPLACE(
                        TRIM(c.city_name),
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
                || ' '
            ) > 0
                THEN 'WORD_CITY_NAME'

            WHEN POSITION(
                ' ' || p.city_query || ' '
                IN
                ' ' ||
                LOWER(
                    REGEXP_REPLACE(
                        TRIM(c.ascii_name),
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
                || ' '
            ) > 0
                THEN 'WORD_ASCII_NAME'

            ELSE 'NO_MATCH'
        END AS city_match_type,

        vm.country_match_type,

        (
            CASE
                WHEN LOWER(TRIM(c.city_name)) = p.city_query
                    THEN 100

                WHEN LOWER(TRIM(c.ascii_name)) = p.city_query
                    THEN 99

                WHEN EXISTS (
                    SELECT 1
                    FROM unnest(c.aliases) AS alias_value
                    WHERE LOWER(TRIM(alias_value)) = p.city_query
                )
                    THEN 98

                WHEN POSITION(
                    ' ' || p.city_query || ' '
                    IN
                    ' ' ||
                    LOWER(
                        REGEXP_REPLACE(
                            TRIM(c.city_name),
                            '[[:space:]]+',
                            ' ',
                            'g'
                        )
                    )
                    || ' '
                ) > 0
                    THEN 70

                WHEN POSITION(
                    ' ' || p.city_query || ' '
                    IN
                    ' ' ||
                    LOWER(
                        REGEXP_REPLACE(
                            TRIM(c.ascii_name),
                            '[[:space:]]+',
                            ' ',
                            'g'
                        )
                    )
                    || ' '
                ) > 0
                    THEN 68

                ELSE 0
            END

            +

            CASE
                WHEN c.is_capital = TRUE
                    THEN 3
                ELSE 0
            END

        )::INTEGER AS location_score

    FROM city_context c

    JOIN valid_markets vm
        ON vm.iso2 = c.market_iso2

    CROSS JOIN params p

    WHERE
        p.city_query <> ''

        AND (
            LOWER(TRIM(c.city_name)) = p.city_query

            OR LOWER(TRIM(c.ascii_name)) = p.city_query

            OR EXISTS (
                SELECT 1
                FROM unnest(c.aliases) AS alias_value
                WHERE LOWER(TRIM(alias_value)) = p.city_query
            )

            OR POSITION(
                ' ' || p.city_query || ' '
                IN
                ' ' ||
                LOWER(
                    REGEXP_REPLACE(
                        TRIM(c.city_name),
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
                || ' '
            ) > 0

            OR POSITION(
                ' ' || p.city_query || ' '
                IN
                ' ' ||
                LOWER(
                    REGEXP_REPLACE(
                        TRIM(c.ascii_name),
                        '[[:space:]]+',
                        ' ',
                        'g'
                    )
                )
                || ' '
            ) > 0
        )
)

SELECT
    city_id,
    geoname_id,
    city_name,
    ascii_name,
    admin1_name,
    admin2_name,
    market_iso2,
    country_name,
    latitude,
    longitude,
    timezone,
    population,
    is_capital,
    priority_tier,
    priority_weight,
    city_match_type,
    country_match_type,
    location_score

FROM candidates

WHERE city_match_type <> 'NO_MATCH'

ORDER BY
    location_score DESC,
    population DESC,
    city_name

LIMIT GREATEST(
    1,
    LEAST(
        COALESCE(p_limit, 10),
        50
    )
);

$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: city_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city_context (
    city_id bigint NOT NULL,
    geoname_id bigint,
    market_iso2 character(2) NOT NULL,
    city_name text NOT NULL,
    ascii_name text,
    aliases text[] DEFAULT ARRAY[]::text[] NOT NULL,
    admin1_code text,
    admin1_name text,
    admin2_code text,
    latitude double precision,
    longitude double precision,
    timezone text,
    population bigint DEFAULT 0 NOT NULL,
    feature_code text,
    is_capital boolean DEFAULT false NOT NULL,
    is_administrative_center boolean DEFAULT false NOT NULL,
    commercial_priority integer DEFAULT 0 NOT NULL,
    prospecting_enabled boolean DEFAULT true NOT NULL,
    source text DEFAULT 'GEONAMES'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin2_name text
);


--
-- Name: city_context_city_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.city_context_city_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: city_context_city_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.city_context_city_id_seq OWNED BY public.city_context.city_id;


--
-- Name: commercial_entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_entities (
    entity_id bigint NOT NULL,
    entity_key text NOT NULL,
    display_name text NOT NULL,
    legal_name text,
    aliases text[] DEFAULT ARRAY[]::text[] NOT NULL,
    entity_type text DEFAULT 'UNKNOWN'::text NOT NULL,
    home_country_iso2 character(2),
    official_domain text,
    official_website text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commercial_entities_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: commercial_entities_entity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commercial_entities_entity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commercial_entities_entity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commercial_entities_entity_id_seq OWNED BY public.commercial_entities.entity_id;


--
-- Name: country_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_context (
    iso2 character(2) NOT NULL,
    iso3 character(3),
    country_name text NOT NULL,
    official_name text,
    aliases text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cc_tlds text[] DEFAULT ARRAY[]::text[] NOT NULL,
    calling_codes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    region text,
    subregion text,
    default_language text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    market_type text DEFAULT 'COUNTRY'::text NOT NULL,
    commercial_scope text DEFAULT 'LATAM'::text NOT NULL,
    priority_tier integer DEFAULT 3 NOT NULL,
    priority_weight integer DEFAULT 10 NOT NULL,
    prospecting_enabled boolean DEFAULT true NOT NULL,
    currency_codes text[] DEFAULT ARRAY[]::text[] NOT NULL,
    language_codes text[] DEFAULT ARRAY[]::text[] NOT NULL
);


--
-- Name: entity_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_relationships (
    relationship_id bigint NOT NULL,
    subject_entity_id bigint NOT NULL,
    object_entity_id bigint NOT NULL,
    relationship_type text NOT NULL,
    country_iso2 character(2),
    evidence_url text NOT NULL,
    evidence_text text,
    confidence integer DEFAULT 0 NOT NULL,
    valid_from date,
    valid_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_relationships_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: entity_relationships_relationship_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entity_relationships_relationship_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entity_relationships_relationship_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entity_relationships_relationship_id_seq OWNED BY public.entity_relationships.relationship_id;


--
-- Name: entity_resolution_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_resolution_cache (
    mentioned_key text NOT NULL,
    country_key text NOT NULL,
    mentioned_name text NOT NULL,
    country_text text NOT NULL,
    country_iso2 character(2),
    brand_entity_id bigint,
    operator_entity_id bigint,
    employer_entity_id bigint,
    relationship_type text DEFAULT 'NO_IDENTIFICADO'::text NOT NULL,
    resolution_status text DEFAULT 'PENDIENTE'::text NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_resolution_cache_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100)))
);


--
-- Name: execution_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_registry (
    id bigint NOT NULL,
    dedup_key text NOT NULL,
    task_type text NOT NULL,
    entity_type text,
    entity_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    input_hash text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    error_message text,
    attempts integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execution_registry_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT execution_registry_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: execution_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.execution_registry ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.execution_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: location_resolution_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_resolution_cache (
    location_key text NOT NULL,
    original_text text NOT NULL,
    market_iso2 character(2),
    city_id bigint,
    country_detected text DEFAULT 'NO IDENTIFICADO'::text NOT NULL,
    city_detected text DEFAULT 'NO IDENTIFICADO'::text NOT NULL,
    admin1_detected text DEFAULT 'NO IDENTIFICADO'::text NOT NULL,
    country_confidence integer DEFAULT 0 NOT NULL,
    city_confidence integer DEFAULT 0 NOT NULL,
    resolution_status text DEFAULT 'PENDIENTE'::text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_resolution_cache_city_confidence_check CHECK (((city_confidence >= 0) AND (city_confidence <= 100))),
    CONSTRAINT location_resolution_cache_country_confidence_check CHECK (((country_confidence >= 0) AND (country_confidence <= 100)))
);


--
-- Name: prospect_contact_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_contact_candidates (
    empresa_key text NOT NULL,
    persona_key text NOT NULL,
    empresa text NOT NULL,
    persona_contacto text NOT NULL,
    cargo_contacto text DEFAULT 'NO IDENTIFICADO'::text NOT NULL,
    fuente_inicial text,
    tipo_fuente_inicial text,
    evidencia_inicial text,
    puntuacion_prioridad integer DEFAULT 0,
    prioridad_verificacion text DEFAULT 'MEDIA'::text,
    estado text DEFAULT 'PENDIENTE_VERIFICACION_INDEPENDIENTE'::text NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: city_context city_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_context ALTER COLUMN city_id SET DEFAULT nextval('public.city_context_city_id_seq'::regclass);


--
-- Name: commercial_entities entity_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_entities ALTER COLUMN entity_id SET DEFAULT nextval('public.commercial_entities_entity_id_seq'::regclass);


--
-- Name: entity_relationships relationship_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_relationships ALTER COLUMN relationship_id SET DEFAULT nextval('public.entity_relationships_relationship_id_seq'::regclass);


--
-- Name: city_context city_context_geoname_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_context
    ADD CONSTRAINT city_context_geoname_id_key UNIQUE (geoname_id);


--
-- Name: city_context city_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_context
    ADD CONSTRAINT city_context_pkey PRIMARY KEY (city_id);


--
-- Name: commercial_entities commercial_entities_entity_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_entities
    ADD CONSTRAINT commercial_entities_entity_key_key UNIQUE (entity_key);


--
-- Name: commercial_entities commercial_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_entities
    ADD CONSTRAINT commercial_entities_pkey PRIMARY KEY (entity_id);


--
-- Name: country_context country_context_iso3_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_context
    ADD CONSTRAINT country_context_iso3_key UNIQUE (iso3);


--
-- Name: country_context country_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_context
    ADD CONSTRAINT country_context_pkey PRIMARY KEY (iso2);


--
-- Name: entity_relationships entity_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_relationships
    ADD CONSTRAINT entity_relationships_pkey PRIMARY KEY (relationship_id);


--
-- Name: entity_resolution_cache entity_resolution_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_resolution_cache
    ADD CONSTRAINT entity_resolution_cache_pkey PRIMARY KEY (mentioned_key, country_key);


--
-- Name: execution_registry execution_registry_dedup_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_registry
    ADD CONSTRAINT execution_registry_dedup_key_key UNIQUE (dedup_key);


--
-- Name: execution_registry execution_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_registry
    ADD CONSTRAINT execution_registry_pkey PRIMARY KEY (id);


--
-- Name: location_resolution_cache location_resolution_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_resolution_cache
    ADD CONSTRAINT location_resolution_cache_pkey PRIMARY KEY (location_key);


--
-- Name: prospect_contact_candidates prospect_contact_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contact_candidates
    ADD CONSTRAINT prospect_contact_candidates_pkey PRIMARY KEY (empresa_key, persona_key);


--
-- Name: idx_city_context_market; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_context_market ON public.city_context USING btree (market_iso2);


--
-- Name: idx_city_context_market_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_context_market_name ON public.city_context USING btree (market_iso2, lower(city_name));


--
-- Name: idx_city_context_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_context_name ON public.city_context USING btree (lower(city_name));


--
-- Name: idx_city_context_population; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_context_population ON public.city_context USING btree (population DESC);


--
-- Name: idx_commercial_entities_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commercial_entities_name ON public.commercial_entities USING btree (lower(display_name));


--
-- Name: idx_country_context_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_context_name ON public.country_context USING btree (lower(country_name));


--
-- Name: idx_entity_relationships_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_relationships_country ON public.entity_relationships USING btree (country_iso2);


--
-- Name: idx_entity_relationships_object; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_relationships_object ON public.entity_relationships USING btree (object_entity_id);


--
-- Name: idx_entity_relationships_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_relationships_subject ON public.entity_relationships USING btree (subject_entity_id);


--
-- Name: idx_execution_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_entity ON public.execution_registry USING btree (entity_type, entity_id);


--
-- Name: idx_execution_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_status ON public.execution_registry USING btree (status);


--
-- Name: idx_execution_task_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_task_type ON public.execution_registry USING btree (task_type);


--
-- Name: idx_location_resolution_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_resolution_city ON public.location_resolution_cache USING btree (city_id);


--
-- Name: idx_location_resolution_market; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_resolution_market ON public.location_resolution_cache USING btree (market_iso2);


--
-- Name: city_context city_context_market_iso2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_context
    ADD CONSTRAINT city_context_market_iso2_fkey FOREIGN KEY (market_iso2) REFERENCES public.country_context(iso2) ON DELETE CASCADE;


--
-- Name: commercial_entities commercial_entities_home_country_iso2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_entities
    ADD CONSTRAINT commercial_entities_home_country_iso2_fkey FOREIGN KEY (home_country_iso2) REFERENCES public.country_context(iso2);


--
-- Name: entity_relationships entity_relationships_country_iso2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_relationships
    ADD CONSTRAINT entity_relationships_country_iso2_fkey FOREIGN KEY (country_iso2) REFERENCES public.country_context(iso2);


--
-- Name: entity_relationships entity_relationships_object_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_relationships
    ADD CONSTRAINT entity_relationships_object_entity_id_fkey FOREIGN KEY (object_entity_id) REFERENCES public.commercial_entities(entity_id) ON DELETE CASCADE;


--
-- Name: entity_relationships entity_relationships_subject_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_relationships
    ADD CONSTRAINT entity_relationships_subject_entity_id_fkey FOREIGN KEY (subject_entity_id) REFERENCES public.commercial_entities(entity_id) ON DELETE CASCADE;


--
-- Name: entity_resolution_cache entity_resolution_cache_brand_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_resolution_cache
    ADD CONSTRAINT entity_resolution_cache_brand_entity_id_fkey FOREIGN KEY (brand_entity_id) REFERENCES public.commercial_entities(entity_id);


--
-- Name: entity_resolution_cache entity_resolution_cache_country_iso2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_resolution_cache
    ADD CONSTRAINT entity_resolution_cache_country_iso2_fkey FOREIGN KEY (country_iso2) REFERENCES public.country_context(iso2);


--
-- Name: entity_resolution_cache entity_resolution_cache_employer_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_resolution_cache
    ADD CONSTRAINT entity_resolution_cache_employer_entity_id_fkey FOREIGN KEY (employer_entity_id) REFERENCES public.commercial_entities(entity_id);


--
-- Name: entity_resolution_cache entity_resolution_cache_operator_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_resolution_cache
    ADD CONSTRAINT entity_resolution_cache_operator_entity_id_fkey FOREIGN KEY (operator_entity_id) REFERENCES public.commercial_entities(entity_id);


--
-- Name: location_resolution_cache location_resolution_cache_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_resolution_cache
    ADD CONSTRAINT location_resolution_cache_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.city_context(city_id);


--
-- Name: location_resolution_cache location_resolution_cache_market_iso2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_resolution_cache
    ADD CONSTRAINT location_resolution_cache_market_iso2_fkey FOREIGN KEY (market_iso2) REFERENCES public.country_context(iso2);


--
-- PostgreSQL database dump complete
--

\unrestrict M7yIufmbz69a8Qbg22utzaiibj3mRaELjiwJjqvgO1zci2wgYcm31wj289cIc85
