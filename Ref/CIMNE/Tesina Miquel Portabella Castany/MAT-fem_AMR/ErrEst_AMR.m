function [E,U] = ErrEst_AMR(dmat,thick,pstrs,Strnod,Struns)

%% ErrEst Estimates the error and computes the strain energy.
%
%  Parameters:
%
%    Input, dmat: Constitutive matrix
%          thick: Thickness
%          pstrs: Flag for Plane Stress
%         Strnod: Smoothed stresses at nodes
%         Struns: Unsmoothed stresses at nodes
%   
%    Output, E the element estimated error vector
%            U the element strain energy vector

  global coordinates;
  global elements;

  nelem = size(elements,1);         % Number of elements
  nnode = size(elements,2);         % Number of nodes per element

  invdmat = inv(dmat);
  E = [];
  U = [];

  if (pstrs == 0)   % Plane Strain
      SN = [Strnod(:,1) Strnod(:,2) Strnod(:,4)];
      ElemStrCte = [Struns(:,1) Struns(:,2) Struns(:,4)];
  else              % Plane Stress
      SN = Strnod;
      ElemStrCte = Struns;
  end
  
% Triangular elements
  if (nnode == 3)
    for ielem = 1 : nelem
    
      lnods = elements(ielem,:);
      nodes(1:nnode,:) = coordinates(lnods(1:nnode),:);
      
  % Compute the volume
      b(1) = nodes(2,2) - nodes(3,2);
      b(2) = nodes(3,2) - nodes(1,2);  
      c(1) = nodes(3,1) - nodes(2,1);
      c(2) = nodes(1,1) - nodes(3,1);
      vol = (abs(b(1)*c(2) - b(2)*c(1)))/2*thick;
    
  % Error estimation and strain energy
      ElemStrSmo = (SN(lnods(1),:)+SN(lnods(2),:)+SN(lnods(3),:))/3;
      ElemStrDif = ElemStrSmo - ElemStrCte(ielem,:);
      E=[E;sqrt(ElemStrDif*invdmat*transpose(ElemStrDif)*vol)];
      U=[U;sqrt(ElemStrSmo*invdmat*transpose(ElemStrSmo)*vol)];
      
    end
      
% Quadrilateral elements
  else
    fform = @(s,t)[(1-s-t+s*t)/4,(1+s-t-s*t)/4,(1+s+t+s*t)/4,(1-s+t-s*t)/4];
    deriv = @(s,t)[(-1+t)/4,( 1-t)/4,( 1+t)/4,(-1-t)/4;
                   (-1+s)/4,(-1-s)/4,( 1+s)/4,( 1-s)/4];
    pospg = [ -0.577350269189626E+00 ,  0.577350269189626E+00 ];
    pespg = [  1.0E+00 ,  1.0E+00 ];
    extrap = [];                % Extrapolation matrix
    order = [ 1 , 4 ; 2 , 3 ];  % Align the G-pts. with the element corners
    for i = 1 : 2
      for j = 1 : 2
          a = 1/pospg(i);
          b = 1/pospg(j);
          extrap(order(i,j),:) = fform(a,b);
      end
    end
    invextrap = inv(extrap);

    for ielem = 1 : nelem
      lnods = elements(ielem,:);
      nodes(1:nnode,:) = coordinates(lnods(1:nnode),:);
      NodeStrSmo = [];
      NodeStrDif = [];
      
  % Compute the volume assigned to each Gauss point
      dvol = [];
      for i = 1 : 2
        for j = 1 : 2
          lcder = deriv(pospg(i),pospg(j));          % SF Local derivatives 
          xjacm = lcder*nodes ;                      % Jacobian matrix
          dvol = [dvol;det(xjacm)*pespg(i)*pespg(j)*thick];
        end
      end
      
  % Stress values at nodes
      for i = 1 : 4
        NodeStrSmo(i,:) = SN(lnods(i),:);
        NodeStrDif(i,:) = NodeStrSmo(i,:) - ElemStrCte((4*(ielem-1)+i),:);
      end
      
  % Stress values at Gauss points
      GaussStrSmo = invextrap*NodeStrSmo;
      GaussStrDif = invextrap*NodeStrDif;
      
  % Error estimation and strain energy
      auxee = [];
      auxeu = [];
      for i = 1 : 4
        auxee(i) = GaussStrDif(i,:)*invdmat*...
                   transpose(GaussStrDif(i,:))*dvol(i);
        auxeu(i) = GaussStrSmo(i,:)*invdmat*...
                   transpose(GaussStrSmo(i,:))*dvol(i);
      end
      E = [E;sqrt(sum(auxee))];
      U = [U;sqrt(sum(auxeu))];
      
    end
      
  end
  
