function S = Stress3D_v1_2(dmat,u)

%% Stress3D Evaluates the stresses at the Gauss points and smooth the 
%           values to the nodes
%
%  Parameters:
%
%    Input, dmat : Constitutive matrix
%              u : Nodal displacements
%   
%    Output, S the nodal stress matrix (nnode, nstrs)

  global coordinates;
  global elements;
 
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  npnod = size(coordinates,1);         % Number of nodes
  nstrs = 6;
  
  nodstr = zeros(npnod,nstrs+1);
  
% Element cycle
  for ielem = 1 : nelem
      
% Recover element properties
    lnods = elements(ielem,:);                         % Elem. connectivity
    coord(1:nnode,:) = coordinates(lnods(1:nnode),:);  % Elem. coordinates

% Find the equation number list for the i-th element
    eqnum = [];                                            % Clear the list
    for i =1 : nnode                                       % Node cycle
      eqnum = [eqnum,lnods(i)*3-2,lnods(i)*3-1,lnods(i)*3];   % Build eq. 
    end                                                       % number list

    displ = u(eqnum);
 
% Evaluate the elemental stress vector
    if (nnode == 4)
      ElemStr = TeStrs3D_v1_2(coord,dmat,displ);        % 4 Nds tetrahedron
      for j = 1 : nstrs
        nodstr(lnods,j) = nodstr(lnods,j) + ElemStr(j);
      end
      nodstr(lnods,nstrs+1) = nodstr(lnods,nstrs+1) + 1;
    else 
      ElemStr = HeStrs3D_v1_2(coord,dmat,displ);        % 8 Nds hexahedron
      for j = 1 : nstrs
        for k = 1 : nnode
          nodstr(lnods(k),j) = nodstr(lnods(k),j) + ElemStr(k,j);
        end
      end
      nodstr(lnods,nstrs+1) = nodstr(lnods,nstrs+1) + 1;
    end
    
  end  % End element cycle
  
  S = [];
  for i = 1 : npnod
    S = [ S ; nodstr(i,1:nstrs)/nodstr(i,nstrs+1) ];
  end
 
