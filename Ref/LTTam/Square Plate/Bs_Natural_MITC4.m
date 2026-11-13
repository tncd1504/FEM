function [Bs]=Bs_Natural_MITC4(nnel,xcoord,ycoord,dNdxi,dNdeta)
% cite from paper : a stabilized one-point integrated quadrilateral
% Reissner-Mindlin plate element (2004)

%--------------------------------------------------------------------------
%                                    ^ eta
%                        (-1,1)    D |    (1,1)
%                          N4 o------o------o N3
%                             |      |      |
%                           A |      |      | C
%                          ---o------|------o---> si
%                             |      |      |
%                             |      |      |
%                          N1 o------o------o N2
%                         (-1,-1)  B |    (1,-1)
%
%                (i,M,L) = {(1,B,A);(2,B,C);(3,D,C);(4,D,A)}
%--------------------------------------------------------------------------
xi  = [-1 1 1 -1];  eta = [-1 -1 1 1];

x = xcoord'; y = ycoord';

a1 = [-1 1 1 -1]'/4; a2 = [-1 -1 1 1]'/4; h = [1 -1 1 -1]'/4;
% dao ham tai cac diem M = (B,D), L=(A,C) 
dxxi = [x'*(a1-h), x'*(a1-h), x'*(a1+h), x'*(a1+h)];
dyxi= [y'*(a1-h) y'*(a1-h) y'*(a1+h) y'*(a1+h)];

dxeta = [x'*(a2-h) x'*(a2+h) x'*(a2+h) x'*(a2-h)];
dyeta = [y'*(a2-h) y'*(a2+h) y'*(a2+h) y'*(a2-h)];

for i=1:nnel
 i1 = (i-1)*3+1;  
 i2 = i1+1;
 i3 = i2+1;
 Bs(1,i1) = dNdxi(i);
 Bs(1,i2) = xi(i)*dyxi(i)*dNdxi(i);
 Bs(1,i3) = -xi(i)*dxxi(i)*dNdxi(i);
 
 Bs(2,i1) = dNdeta(i);
 Bs(2,i2) = eta(i)*dyeta(i)*dNdeta(i);
 Bs(2,i3) = -eta(i)*dxeta(i)*dNdeta(i);
end




