from aiogram.fsm.state import State, StatesGroup

class AdState(StatesGroup):
    title = State()
    image_url = State()
    link_url = State()
    duration = State()

class CompState(StatesGroup):
    title = State()
    desc = State()
    reward = State()
    start_time = State()
    end_time = State()

class UserSearchState(StatesGroup):
    user_id = State()

class BroadcastState(StatesGroup):
    content = State()
    confirm = State()

class PaidRoomState(StatesGroup):
    max_participants = State()
    code_status = State()
    deactivate_code = State()
