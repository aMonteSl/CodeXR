! Fortran fixture for CodeXR metrics
module metrics_mod
contains
  integer function compute(values, limit)
    integer, intent(in) :: values(3), limit
    integer :: i
    compute = 0
    do i = 1, 3
      if (values(i) > limit) then
        if (mod(values(i), 2) == 0) then
          compute = compute + values(i)
        else
          compute = compute + limit
        end if
      end if
    end do
  end function compute

  integer function helper(value, offset)
    integer, intent(in) :: value, offset
    if (value > offset) then
      if (offset > 0) then
        helper = value + offset
      else
        helper = value
      end if
    else
      helper = value
    end if
  end function helper
end module metrics_mod
