%--------------------------------------------------------
%purpose:
%compute the length of each side of the element
%
%Synopsis:
%[side]=cal_side(x,y)
%
%variable description:
%side - the length of each side of the element
%x - x coord value of element
%y - y coord value of element
%--------------------------------------------------------

function [side]=cal_side(x,y)

nsel=length(x);     %nsel n: number   s:side   el:element

for ie=1:nsel    
    if ie==nsel
        side(nsel)=sqrt((x(nsel)-x(1))^2+(y(nsel)-y(1))^2);        %length of side nsel        
    else
        side(ie)=sqrt((x(ie)-x(ie+1))^2+(y(ie)-y(ie+1))^2);        %length of side ie
    end
end

        
