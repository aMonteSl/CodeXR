%% Erlang fixture for CodeXR metrics
-module(erlang_metrics).
-export([compute/2, helper/2]).

compute(Values, Limit) ->
    lists:foldl(fun(Value, Acc) ->
        if
            Value > Limit ->
                if
                    Value rem 2 =:= 0 -> Acc + Value;
                    true -> Acc + Limit
                end;
            true -> Acc
        end
    end, 0, Values).

helper(Value, Offset) ->
    case Value of
        N when N > Offset ->
            if
                Offset > 0 -> N + Offset;
                true -> N
            end;
        _ -> Value
    end.
