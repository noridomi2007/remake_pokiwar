#!/usr/bin/env python3
"""
Extract authentic UI, backgrounds, 6 gem sprites, 5 element badges, upgrade stones,
classic monster pets, trainer avatars, battle cards, and audio clips from D:\\GAME\\Pokiguard
into d:\\GAME\\Pokiwar\\apps\\client\\public\\assets\\pokiguard\\.
"""
import os
import re
import shutil
import UnityPy

POKI_SRC_BUNDLE = r"D:\GAME\Pokiguard\assets\aa\Android\ui-panels_assets_all_7b195dd2948b1c66ce3982274cc9dc1c.bundle"
POKI_SRC_DATA = r"D:\GAME\Pokiguard\assets\bin\Data"
OUT_ROOT = r"d:\GAME\Pokiwar\apps\client\public\assets\pokiguard"

WANTED_PET_IDS = {
    # Thỏ Ngọc / Thủy Bunny
    10, 11, 1431,
    # Hỏa Sư Hoàng Kim
    581, 582, 583, 2257,
    # Thủy Long Seadra
    805, 806, 807, 922,
    # Thanh Long Flygon
    850, 851, 852, 2184,
    # Hoàng Kim Chiến Thần
    1439, 1440, 1282, 2097,
    # Thổ Nham Thần Quy & Nham Thạch Cự Nhân
    1203, 1204, 718, 719, 720,
    # Thời Không Băng Long
    920, 921, 2349, 2023,
    # Tề Thiên Chiến Hầu
    507, 508, 509, 1434,
    # Gấu Trúc Thần Công
    723, 724, 725, 940,
    # Hỏa Viêm Ma Vương
    596, 597, 598, 601,
    # Extra iconic stages / collection
    458, 459, 460, 628, 629, 630, 1976, 1977, 2243, 1437,
}

WANTED_AVATAR_IDS = {8, 26, 27, 28, 29, 30, 31, 32, 34, 37}

WANTED_CARDS = {
    "card1", "card2", "card3", "card4", "card5", "card6",
    "card7", "card8", "card9", "card10", "card11", "card12", "cardBoss",
}

WANTED_TEXTURE_EXACT = {
    # Gems & elements
    "gem_attack", "gem_mana", "gem_rage", "gem_heal", "gem_armor", "gem_steal",
    "METAL", "WOOD", "WATER", "FIRE", "EARTH",
    # Backgrounds & Lobby islands
    "HomeBG_NewDesign", "bg_islands", "bg_island_detail", "bg_arena", "bg_field",
    "bgBoard", "bg_legend", "boss_bg", "arena_bg2",
    "Background-Background 1 (1)", "Background-Background 1 (3)",
    "ChatGPT Image Jul 5, 2026, 08_01_31 PM",
    "background-01-refined-gaj_ab45a87c50f84043",
    # Classic Buildings
    "Buildings-Arena", "Buildings-ArenaPVP", "Buildings-campaign", "Buildings-Evolve",
    "Buildings-Guild", "Buildings-HellGate", "Buildings-Tower",
    "Buildings-WhishingWheel", "Buildings-WorldBoss",
    # Floating islands icons (Chinh Phuc)
    "card2", "cards-02", "cards-03", "cards-04", "cards-05", "cards-06",
    "cards-07", "cards-08", "cards-09", "cards-10", "cards-11",
    # Misc single textures
    "vs_emblem", "gold", "crystal", "hp_frame", "userBG", "frameAvatar",
    "turn", "your_turn", "banner_win", "banner_success", "haoquang", "pedestal",
    "pedestal_blue", "standSlot", "standBoss", "btnFight", "btnClose", "btn_close_x",
    "petInfo", "bossInfo", "bgName", "list_bg", "panel_stone", "socket_stone",
    "gold_star", "sunburst_gold", "twinkle", "sparkle_star", "btnOk",
    "Characters-Characters 1 Refined",
    # Stones Lv1..Lv5
    "stone_e_1", "stone_e_2", "stone_e_3", "stone_e_4", "stone_e_5",
    "stone_f_1", "stone_f_2", "stone_f_3", "stone_f_4", "stone_f_5",
    "stone_g_1", "stone_g_2", "stone_g_3", "stone_g_4", "stone_g_5",
    "stone_m_1", "stone_m_2", "stone_m_3", "stone_m_4", "stone_m_5",
    "stone_w_1", "stone_w_2", "stone_w_3", "stone_w_4", "stone_w_5",
}


def sanitize(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name.strip())


def export_clean_sprites(env_b, env_d, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    saved = {}

    def put(out_name: str, img):
        path = os.path.join(out_dir, f"{out_name}.png")
        img.save(path)
        saved[out_name] = path

    # 1. Exact single textures first
    for env in (env_b, env_d):
        for o in env.objects:
            if o.type.name == "Texture2D":
                try:
                    d = o.read()
                    if d.m_Name in WANTED_TEXTURE_EXACT and d.m_Name not in saved:
                        # Handle cards-02..11 specifically so we get the floating islands (>= 200px wide & tall or known)
                        if d.m_Name.startswith("cards-0") or d.m_Name.startswith("cards-1"):
                            if d.m_Width < 250 or d.m_Height < 250:
                                continue
                        safe = sanitize(d.m_Name)
                        put(safe, d.image)
                except Exception:
                    pass

    # 2. Extract the iconic classic floating island background (`bg` from level1's 8d00661514a3ff94baf4115e5f4437df)
    lobby_bg_file = os.path.join(POKI_SRC_DATA, "8d00661514a3ff94baf4115e5f4437df")
    if os.path.exists(lobby_bg_file):
        e = UnityPy.load(lobby_bg_file)
        for o in e.objects:
            if o.type.name == "Texture2D":
                d = o.read()
                put("lobby_classic_bg", d.image)
                break

    # 3. Extract specific sized Sprites cleanly without collisions
    def match_sprite(o, name, im):
        w, h = im.width, im.height
        if name == "Gemini_Generated_Image_c5n4n4c5n4n4c5n4_0":
            return "battle_top_bar"
        if name == "Gemini_Generated_Image_c5n4n4c5n4n4c5n4_8":
            return "battle_turn_orb"
        if name == "cards-01_0" and 550 <= w <= 640 and 950 <= h <= 1050:
            return "skill_card_frame"
        if name == "badges-02 1_0":
            return "pill_mana"
        if name == "badges-04 1_0":
            return "pill_rage"
        if name == "bgGift_l.png_0":
            return "side_card_bg"
        if name == "Cards-Cards 4":
            return "stone_card_bg"
        if name == "Cards-Cards 2 Refined Refined_0":
            return "card_frame_blue"
        if name == "Cards-Cards 3 Refined Refined_0":
            return "card_frame_gold"
        if name == "panels-01 1_0" and w >= 900:
            return "panel_frame_main"
        if name == "panels-02_0" and 440 <= w <= 470 and 130 <= h <= 160:
            return "banner_header_gold"
        if name == "panels-02 1_0" and w >= 800:
            return "banner_header_wing"
        if name == "panels-03_0" and 400 <= w <= 430 and 125 <= h <= 150:
            return "nameplate_blue"
        if name == "panels-04_0" and 460 <= w <= 500 and 140 <= h <= 165:
            return "nameplate_red"
        if name == "panels-07_0" and w >= 460:
            return "pedestal_altar"
        if name == "buttons-04_0" and 480 <= w <= 515 and 160 <= h <= 190:
            return "btn_gold_pill"
        if name == "buttons-01 1" and w >= 300:
            return "btn_back_blue"
        if name == "characters-01_0" and w >= 450:
            return "charm_binh_an"
        if name == "characters-02" and w >= 450:
            return "charm_may_man"
        if name == "bars-01_0" and 450 <= w <= 480 and 125 <= h <= 150:
            return "hud_bar_name"
        if name == "bars-02_0" and 480 <= w <= 510 and 130 <= h <= 155:
            return "hud_bar_exp"
        if name == "bars-03_0" and 440 <= w <= 480 and 130 <= h <= 155:
            return "hud_bar_energy"
        if name == "bars-04_0" and 450 <= w <= 485 and 125 <= h <= 150:
            return "hud_bar_gold"
        if name == "bars-05_0" and 445 <= w <= 480 and 135 <= h <= 160:
            return "hud_bar_gem"
        if name == "buttons-03" and 400 <= w <= 440 and 410 <= h <= 450:
            return "hud_crown"
        if name == "buttons-05_0" and 160 <= w <= 220 and 160 <= h <= 220:
            return "btn_settings"
        if name == "navigation-01_0" and 200 <= w <= 260:
            return "dock_shop"
        if name == "navigation-02_0" and 200 <= w <= 260:
            return "dock_checkin"
        if name == "navigation-03_0" and 200 <= w <= 260:
            return "dock_cards"
        if name == "navigation-05_0" and 200 <= w <= 260:
            return "dock_events"
        if name == "buttons-06_0" and 200 <= w <= 260:
            return "dock_gift"
        if name == "buttons-06_1" and 200 <= w <= 260:
            return "dock_party"
        if name == "buttons-06_2" and 200 <= w <= 260:
            return "dock_rank"
        if name == "buttons-07_0" and 200 <= w <= 260:
            return "dock_missions"
        if name == "unknown-01_0":
            return "bldg_worldboss"
        if name == "unknown-02_0":
            return "bldg_arena"
        if name == "unknown-03_0":
            return "bldg_evolve"
        if name == "unknown-05_0":
            return "bldg_conquer"
        if name == "unknown-06_0":
            return "bldg_event"
        if name == "unknown-08_0":
            return "bldg_petlab"
        if name == "decorations-01_0" and 250 <= w <= 450:
            return "bldg_top"
        if name == "icons-01_0" and w >= 120:
            return "ico_sword"
        if name == "icons-02_0" and w >= 100:
            return "ico_bolt"
        if name == "icons-03 1_0" and w >= 100:
            return "ico_fire_scroll"
        if name == "icons-03 1_1" and w >= 100:
            return "ico_shield"
        if name == "icons-07_0" and w >= 100:
            return "ico_heart"
        if name == "icons-12_0" and w >= 100:
            return "ico_water"
        if name == "1151_1085":
            return "ico_ice_shield"
        if name == "common_popup_ui_77":
            return "ico_medal"
        return None

    for env in (env_b, env_d):
        for o in env.objects:
            if o.type.name == "Sprite":
                try:
                    d = o.read()
                    im = d.image
                    if im is None:
                        continue
                    alias = match_sprite(o, d.m_Name, im)
                    if alias and alias not in saved:
                        put(alias, im)
                except Exception:
                    pass

    return saved


def export_pets_avatars_cards(env_d):
    pets_dir = os.path.join(OUT_ROOT, "pets")
    avatars_dir = os.path.join(OUT_ROOT, "avatars")
    cards_dir = os.path.join(OUT_ROOT, "cards")
    for d in (pets_dir, avatars_dir, cards_dir):
        os.makedirs(d, exist_ok=True)

    best_pets = {}
    best_avatars = {}
    best_cards = {}

    for o in env_d.objects:
        if o.type.name == "Texture2D":
            try:
                d = o.read()
                name = d.m_Name
                if name.isdigit():
                    num = int(name)
                    if num in WANTED_PET_IDS and d.m_Width >= 150:
                        if num not in best_pets or d.m_Width * d.m_Height > best_pets[num].width * best_pets[num].height:
                            best_pets[num] = d.image.copy()
                    elif num in WANTED_AVATAR_IDS and d.m_Width >= 120:
                        if num not in best_avatars or d.m_Width * d.m_Height > best_avatars[num].width * best_avatars[num].height:
                            best_avatars[num] = d.image.copy()
                elif name in WANTED_CARDS and d.m_Width >= 80:
                    if name not in best_cards or d.m_Width * d.m_Height > best_cards[name].width * best_cards[name].height:
                        best_cards[name] = d.image.copy()
            except Exception:
                pass

    for pid, im in best_pets.items():
        im.save(os.path.join(pets_dir, f"{pid}.png"))
    for aid, im in best_avatars.items():
        im.save(os.path.join(avatars_dir, f"{aid}.png"))
    for cid, im in best_cards.items():
        im.save(os.path.join(cards_dir, f"{cid}.png"))

    print(f"Exported {len(best_pets)}/{len(WANTED_PET_IDS)} pets, {len(best_avatars)}/{len(WANTED_AVATAR_IDS)} avatars, {len(best_cards)}/{len(WANTED_CARDS)} cards.")


def export_audio(env_b, env_d):
    audio_dir = os.path.join(OUT_ROOT, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    wanted_audio = {"match1", "match2", "match3", "match4", "match5", "match6", "tick1", "tick2", "fight1"}
    count = 0
    for env in (env_b, env_d):
        for o in env.objects:
            if o.type.name != "AudioClip":
                continue
            try:
                clip = o.read()
                cname = sanitize(getattr(clip, "m_Name", ""))
                if cname not in wanted_audio:
                    continue
                samples = getattr(clip, "samples", None)
                if not samples:
                    continue
                for sname, raw in samples.items():
                    ext = os.path.splitext(sname)[1] or ".wav"
                    with open(os.path.join(audio_dir, f"{cname}{ext}"), "wb") as f:
                        f.write(raw)
                    count += 1
            except Exception:
                pass
    print(f"Exported {count} audio clips.")


def main():
    print("Loading PokiGuard bundle & bin/Data...")
    env_b = UnityPy.load(POKI_SRC_BUNDLE)
    env_d = UnityPy.load(POKI_SRC_DATA)

    saved_ui = export_clean_sprites(env_b, env_d, os.path.join(OUT_ROOT, "sprites"))
    print(f"Exported {len(saved_ui)} UI/Environment sprites.")
    export_pets_avatars_cards(env_d)
    export_audio(env_b, env_d)


if __name__ == "__main__":
    main()
