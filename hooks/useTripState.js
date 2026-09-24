"use client";

import { useReducer, useCallback } from "react";

const ACTIONS = {
  SET_TRIP: "SET_TRIP",
  TOGGLE_ACTIVITY: "TOGGLE_ACTIVITY",
  DELETE_ACTIVITY: "DELETE_ACTIVITY",
  DELETE_DAY: "DELETE_DAY",
  EDIT_ACTIVITY: "EDIT_ACTIVITY",
  REORDER_ACTIVITIES: "REORDER_ACTIVITIES",
  REORDER_DAYS: "REORDER_DAYS",
  TOGGLE_PACKING_ITEM: "TOGGLE_PACKING_ITEM",
  CLEAR_TRIP: "CLEAR_TRIP",
};

function tripReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_TRIP:
      return {
        ...action.payload,
        // Add checked state to packing list
        packingList: (action.payload.packingList || []).map((item) =>
          typeof item === "string" ? { text: item, checked: false } : item
        ),
      };

    case ACTIONS.TOGGLE_ACTIVITY: {
      const { dayId, activityId } = action.payload;
      return {
        ...state,
        stops: state.stops.map((stop) =>
          stop.id === dayId
            ? {
                ...stop,
                activities: stop.activities.map((act) =>
                  act.id === activityId
                    ? { ...act, completed: !act.completed }
                    : act
                ),
              }
            : stop
        ),
      };
    }

    case ACTIONS.DELETE_ACTIVITY: {
      const { dayId, activityId } = action.payload;
      return {
        ...state,
        stops: state.stops.map((stop) =>
          stop.id === dayId
            ? {
                ...stop,
                activities: stop.activities.filter(
                  (act) => act.id !== activityId
                ),
              }
            : stop
        ),
      };
    }

    case ACTIONS.DELETE_DAY: {
      return {
        ...state,
        stops: state.stops.filter((stop) => stop.id !== action.payload.dayId),
      };
    }

    case ACTIONS.EDIT_ACTIVITY: {
      const { dayId, activityId, updates } = action.payload;
      return {
        ...state,
        stops: state.stops.map((stop) =>
          stop.id === dayId
            ? {
                ...stop,
                activities: stop.activities.map((act) =>
                  act.id === activityId ? { ...act, ...updates } : act
                ),
              }
            : stop
        ),
      };
    }

    case ACTIONS.REORDER_ACTIVITIES: {
      const { dayId, activities } = action.payload;
      return {
        ...state,
        stops: state.stops.map((stop) =>
          stop.id === dayId ? { ...stop, activities } : stop
        ),
      };
    }

    case ACTIONS.REORDER_DAYS: {
      return {
        ...state,
        stops: action.payload.stops,
      };
    }

    case ACTIONS.TOGGLE_PACKING_ITEM: {
      const { index } = action.payload;
      return {
        ...state,
        packingList: state.packingList.map((item, i) =>
          i === index ? { ...item, checked: !item.checked } : item
        ),
      };
    }

    case ACTIONS.CLEAR_TRIP:
      return null;

    default:
      return state;
  }
}

export function useTripState() {
  const [trip, dispatch] = useReducer(tripReducer, null);

  const setTrip = useCallback(
    (data) => dispatch({ type: ACTIONS.SET_TRIP, payload: data }),
    []
  );

  const toggleActivity = useCallback(
    (dayId, activityId) =>
      dispatch({
        type: ACTIONS.TOGGLE_ACTIVITY,
        payload: { dayId, activityId },
      }),
    []
  );

  const deleteActivity = useCallback(
    (dayId, activityId) =>
      dispatch({
        type: ACTIONS.DELETE_ACTIVITY,
        payload: { dayId, activityId },
      }),
    []
  );

  const deleteDay = useCallback(
    (dayId) =>
      dispatch({ type: ACTIONS.DELETE_DAY, payload: { dayId } }),
    []
  );

  const editActivity = useCallback(
    (dayId, activityId, updates) =>
      dispatch({
        type: ACTIONS.EDIT_ACTIVITY,
        payload: { dayId, activityId, updates },
      }),
    []
  );

  const reorderActivities = useCallback(
    (dayId, activities) =>
      dispatch({
        type: ACTIONS.REORDER_ACTIVITIES,
        payload: { dayId, activities },
      }),
    []
  );

  const reorderDays = useCallback(
    (stops) =>
      dispatch({ type: ACTIONS.REORDER_DAYS, payload: { stops } }),
    []
  );

  const togglePackingItem = useCallback(
    (index) =>
      dispatch({ type: ACTIONS.TOGGLE_PACKING_ITEM, payload: { index } }),
    []
  );

  const clearTrip = useCallback(
    () => dispatch({ type: ACTIONS.CLEAR_TRIP }),
    []
  );

  return {
    trip,
    setTrip,
    toggleActivity,
    deleteActivity,
    deleteDay,
    editActivity,
    reorderActivities,
    reorderDays,
    togglePackingItem,
    clearTrip,
  };
}
